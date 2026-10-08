/**
 * store.js —— 数据层（纯逻辑，无 DOM 依赖）
 *
 * 设计说明：
 * 本文件是整个项目的「核心业务逻辑层」，所有函数都是纯函数或对 localStorage 的
 * 薄封装。把它与视图层（views.js）、入口层（app.js）分离，目的是：
 *   1. 便于单元测试 —— 测试时不需要浏览器 DOM，直接引入本文件即可断言；
 *   2. 便于将来替换存储后端（例如换成后端 API），视图层代码无需改动。
 *
 * 使用原生 ES5/ES6 语法编写，不依赖任何第三方框架，保证双击 HTML 即可运行。
 */
(function (global) {
  'use strict';

  /** localStorage 中使用的键名，集中管理避免散落的魔法字符串 */
  var STORAGE_KEY = 'fzu_lost_found_items_v1';
  var SEED_KEY = 'fzu_lost_found_seeded_v1';

  /** 物品状态常量 */
  var STATUS = {
    OPEN: 'open',       // 待认领 / 待归还
    CLOSED: 'closed'    // 已找到 / 已归还
  };

  /** 信息类型常量 */
  var TYPE = {
    LOST: 'lost',     // 寻物启事：我丢了东西
    FOUND: 'found'    // 招领启事：我捡到东西
  };

  /**
   * 生成唯一 ID。
   * 使用「时间戳 + 随机串」，无需依赖数据库自增主键。
   * @returns {string}
   */
  function generateId() {
    return 'LF' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  }

  /**
   * 表单校验：校验一条发布信息的必填项与格式。
   * 单独抽出为纯函数，方便单元测试直接构造异常数据。
   *
   * @param {Object} data 待校验的表单数据
   * @returns {{valid: boolean, errors: Object}} errors 以字段名为键，值为错误提示
   */
  function validateItem(data) {
    var errors = {};
    if (!data || typeof data !== 'object') {
      return { valid: false, errors: { _global: '数据格式不正确' } };
    }

    if (!data.title || String(data.title).trim().length < 2) {
      errors.title = '物品名称至少需要 2 个字符';
    } else if (String(data.title).trim().length > 30) {
      errors.title = '物品名称不能超过 30 个字符';
    }

    if (!data.type || (data.type !== TYPE.LOST && data.type !== TYPE.FOUND)) {
      errors.type = '请选择信息类型（寻物 / 招领）';
    }

    if (!data.category || String(data.category).trim() === '') {
      errors.category = '请选择物品类别';
    }

    if (!data.place || String(data.place).trim() === '') {
      errors.place = '请填写地点';
    }

    if (!data.date || !/^\d{4}-\d{2}-\d{2}$/.test(String(data.date))) {
      errors.date = '请选择有效的日期（格式 YYYY-MM-DD）';
    } else if (String(data.date) > todayString()) {
      errors.date = '日期不能晚于今天';
    }

    // 联系方式：手机号或 QQ/微信，至少填一种且格式大致正确
    var contact = data.contact || {};
    var phoneOk = /^1[3-9]\d{9}$/.test(String(contact.phone || '').trim());
    var imOk = String(contact.im || '').trim().length >= 4;
    if (!phoneOk && !imOk) {
      errors.contact = '请至少填写一个有效的联系方式（11 位手机号，或 QQ / 微信号）';
    }

    var keys = Object.keys(errors);
    return { valid: keys.length === 0, errors: errors };
  }

  /**
   * 取得今天的日期字符串 YYYY-MM-DD（本地时区）。
   * @returns {string}
   */
  function todayString() {
    var d = new Date();
    var m = String(d.getMonth() + 1).padStart(2, '0');
    var day = String(d.getDate()).padStart(2, '0');
    return d.getFullYear() + '-' + m + '-' + day;
  }

  /**
   * 关键词搜索 + 多条件筛选。
   *
   * 搜索范围：物品名称、详细描述、地点。不区分大小写，自动 trim。
   * 筛选维度：类型（寻物/招领）、类别、状态。
   *
   * @param {Array}  items  数据源
   * @param {Object} query  { keyword, type, category, status }
   * @returns {Array} 过滤后的新数组（不修改原数组）
   */
  function searchItems(items, query) {
    var list = Array.isArray(items) ? items.slice() : [];
    if (!query) { return list; }

    var keyword = String(query.keyword || '').trim().toLowerCase();

    return list.filter(function (item) {
      if (keyword) {
        var haystack = [
          item.title || '',
          item.description || '',
          item.place || ''
        ].join(' ').toLowerCase();
        if (haystack.indexOf(keyword) === -1) { return false; }
      }
      if (query.type && item.type !== query.type) { return false; }
      if (query.category && item.category !== query.category) { return false; }
      if (query.status && item.status !== query.status) { return false; }
      return true;
    });
  }

  /**
   * 按发布时间倒序排序（新的在前）。
   * 返回新数组，避免污染调用方的数据。
   * @param {Array} items
   * @returns {Array}
   */
  function sortByTimeDesc(items) {
    return (Array.isArray(items) ? items.slice() : []).sort(function (a, b) {
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
  }

  /**
   * 更新单条信息的状态（标记为已找到 / 已归还）。
   * 采用不可变风格：返回更新后的完整数组，不修改入参。
   *
   * @param {Array}  items
   * @param {string} id
   * @param {string} status STATUS.OPEN 或 STATUS.CLOSED
   * @returns {Array} 更新后的数组；若 id 不存在则原样返回拷贝
   */
  function updateStatus(items, id, status) {
    var list = Array.isArray(items) ? items : [];
    return list.map(function (item) {
      if (item.id !== id) { return item; }
      var next = Object.assign({}, item);
      next.status = status;
      // 记录状态变更时间，看板「平均找回时长」统计会用到
      next.statusUpdatedAt = status === STATUS.CLOSED ? new Date().toISOString() : null;
      return next;
    });
  }

  /**
   * 计算统计数据，供「数据看板」页面渲染使用。
   *
   * @param {Array} items
   * @returns {{total:number, lost:number, found:number, closed:number, open:number,
   *            closedRate:number, byCategory:Object, last7Days:Array}}
   */
  function calcStats(items) {
    var list = Array.isArray(items) ? items : [];
    var stats = {
      total: list.length,
      lost: 0,
      found: 0,
      closed: 0,
      open: 0,
      closedRate: 0,
      byCategory: {},
      last7Days: []
    };

    list.forEach(function (item) {
      if (item.type === TYPE.LOST) { stats.lost++; }
      if (item.type === TYPE.FOUND) { stats.found++; }
      if (item.status === STATUS.CLOSED) { stats.closed++; } else { stats.open++; }

      var cat = item.category || '其他';
      stats.byCategory[cat] = (stats.byCategory[cat] || 0) + 1;
    });

    stats.closedRate = stats.total === 0
      ? 0
      : Math.round((stats.closed / stats.total) * 100);

    // 近 7 天每日发布量，用于折线图
    var today = new Date();
    today.setHours(0, 0, 0, 0);
    for (var i = 6; i >= 0; i--) {
      var day = new Date(today.getTime() - i * 86400000);
      var key = day.getFullYear() + '-' +
        String(day.getMonth() + 1).padStart(2, '0') + '-' +
        String(day.getDate()).padStart(2, '0');
      var count = list.filter(function (item) {
        return String(item.createdAt).slice(0, 10) === key;
      }).length;
      stats.last7Days.push({ date: key, count: count });
    }

    return stats;
  }

  /**
   * 读取全部数据。若 localStorage 中没有数据，返回空数组。
   * @returns {Array}
   */
  function load() {
    try {
      var raw = global.localStorage.getItem(STORAGE_KEY);
      if (!raw) { return []; }
      var parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch (e) {
      // localStorage 被禁用或数据损坏时，降级为空列表，避免整站白屏
      console.warn('[store] 读取本地数据失败，已降级为空列表：', e);
      return [];
    }
  }

  /**
   * 写入全部数据。
   * @param {Array} items
   * @returns {boolean} 是否写入成功
   */
  function save(items) {
    try {
      global.localStorage.setItem(STORAGE_KEY, JSON.stringify(items || []));
      return true;
    } catch (e) {
      console.error('[store] 写入本地数据失败：', e);
      return false;
    }
  }

  /**
   * 新增一条信息：自动补全 id / createdAt / status 后写入。
   * @param {Object} data
   * @returns {Object} 新增后的完整记录
   */
  function addItem(data) {
    var items = load();
    var now = new Date().toISOString();
    var record = Object.assign({}, data, {
      id: generateId(),
      createdAt: now,
      status: data.status || STATUS.OPEN,
      statusUpdatedAt: null
    });
    items.push(record);
    save(items);
    return record;
  }

  /**
   * 删除一条信息（「我的」页面里本人可删除误发内容）。
   * @param {string} id
   * @returns {Array} 删除后的数组
   */
  function removeItem(id) {
    var items = load().filter(function (item) { return item.id !== id; });
    save(items);
    return items;
  }

  /**
   * 按 id 查找单条信息。
   * @param {Array} items
   * @param {string} id
   * @returns {Object|null}
   */
  function findById(items, id) {
    var list = Array.isArray(items) ? items : [];
    for (var i = 0; i < list.length; i++) {
      if (list[i].id === id) { return list[i]; }
    }
    return null;
  }

  /**
   * 计算两个日期之间相差的天数（用于展示「已发布 N 天」）。
   * @param {string} from ISO 或 YYYY-MM-DD
   * @param {string} [to] 默认今天
   * @returns {number}
   */
  function daysBetween(from, to) {
    var a = new Date(from).getTime();
    var b = to ? new Date(to).getTime() : Date.now();
    if (isNaN(a) || isNaN(b)) { return 0; }
    return Math.floor(Math.abs(b - a) / 86400000);
  }

  /**
   * 对联系方式做脱敏展示：手机号中间四位打码。
   * 详情页默认脱敏，点击「查看完整联系方式」后展开，防止被爬虫批量抓取。
   * @param {string} phone
   * @returns {string}
   */
  function maskPhone(phone) {
    var p = String(phone || '');
    if (!/^1\d{10}$/.test(p)) { return p; }
    return p.slice(0, 3) + '****' + p.slice(7);
  }

  /**
   * 导出为对外暴露的模块对象。
   * 同时兼容浏览器全局（window.LFStore）与 Node/CommonJS（单元测试用）。
   */
  var api = {
    STATUS: STATUS,
    TYPE: TYPE,
    STORAGE_KEY: STORAGE_KEY,
    SEED_KEY: SEED_KEY,
    generateId: generateId,
    validateItem: validateItem,
    todayString: todayString,
    searchItems: searchItems,
    sortByTimeDesc: sortByTimeDesc,
    updateStatus: updateStatus,
    calcStats: calcStats,
    load: load,
    save: save,
    addItem: addItem,
    removeItem: removeItem,
    findById: findById,
    daysBetween: daysBetween,
    maskPhone: maskPhone
  };

  global.LFStore = api;
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
})(typeof window !== 'undefined' ? window : globalThis);
