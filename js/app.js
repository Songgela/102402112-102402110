/**
 * app.js —— 应用入口与交互控制层
 *
 * 职责：
 *   1. 页面路由切换（首页 / 全部信息 / 发布 / 看板 / 我的）
 *   2. 事件绑定（全部使用事件委托，避免重复绑定）
 *   3. 将 store 的数据经 views 渲染后挂载到 DOM
 *
 * 分层原则：app.js 不做数据运算（交给 store），不拼 HTML 字符串（交给 views），
 * 只做「编排」——这是本项目的架构约定。
 */
(function (global) {
  'use strict';

  var Store = global.LFStore;
  var Data = global.LFData;
  var Views = global.LFViews;

  /** 当前已打开的详情 id，用于「标记完成」后刷新抽屉 */
  var currentDetailId = null;
  /** 详情页手机号是否已展开（脱敏 -> 明文） */
  var phoneRevealed = false;

  /* ------------------------------------------------------------------ */
  /* 工具函数                                                            */
  /* ------------------------------------------------------------------ */

  /** 简写 querySelector */
  function $(sel, root) { return (root || document).querySelector(sel); }
  /** 简写 querySelectorAll（转数组，便于 forEach） */
  function $$(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }

  /**
   * 顶部轻提示。
   * @param {string} msg
   * @param {string} [type] success | error | 空为普通
   */
  function toast(msg, type) {
    var wrap = $('#toast-wrap');
    var el = document.createElement('div');
    el.className = 'toast' + (type ? ' toast--' + type : '');
    el.textContent = msg;
    wrap.appendChild(el);
    setTimeout(function () {
      el.style.opacity = '0';
      el.style.transform = 'translateY(-10px)';
      el.style.transition = 'all .25s';
      setTimeout(function () { el.remove(); }, 260);
    }, 1900);
  }

  /**
   * 复制文本到剪贴板，带降级方案。
   * 为什么需要降级？—— 在 file:// 协议下 navigator.clipboard 可能不可用，
   * 而本作业要求「下载后双击 HTML 直接运行」，因此必须保证复制功能在本地也能用。
   * @param {string} text
   */
  function copyText(text) {
    function fallback() {
      var ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      try {
        document.execCommand('copy');
        toast('已复制：' + text, 'success');
      } catch (e) {
        toast('复制失败，请手动选择复制', 'error');
      }
      ta.remove();
    }

    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(function () {
        toast('已复制：' + text, 'success');
      }).catch(fallback);
    } else {
      fallback();
    }
  }

  /* ------------------------------------------------------------------ */
  /* 路由                                                               */
  /* ------------------------------------------------------------------ */

  /**
   * 切换到指定页面。
   * @param {string} name home | browse | publish | dashboard | mine
   */
  function go(name) {
    $$('.page').forEach(function (p) { p.classList.remove('is-active'); });
    var page = $('#page-' + name);
    if (page) { page.classList.add('is-active'); }

    $$('.nav-link').forEach(function (l) {
      l.classList.toggle('is-active', l.getAttribute('data-nav') === name);
    });

    if (name === 'home') { renderHome(); }
    if (name === 'browse') { renderBrowse(); }
    if (name === 'dashboard') { renderDashboard(); }
    if (name === 'mine') { renderMine(); }

    global.scrollTo({ top: 0, behavior: 'smooth' });
  }

  /* ------------------------------------------------------------------ */
  /* 渲染：首页                                                          */
  /* ------------------------------------------------------------------ */

  function renderHome() {
    var items = Store.load();
    var stats = Store.calcStats(items);

    // 更新 Hero 统计
    $$('#hero-stats [data-stat]').forEach(function (el) {
      var key = el.getAttribute('data-stat');
      var val = key === 'rate' ? stats.closedRate + '%' : stats[key];
      // 数字滚动动画
      animateNumber(el, parseInt(el.textContent, 10) || 0, parseInt(val, 10) || 0, key === 'rate');
    });

    // 首页展示最新 8 条
    var latest = Store.sortByTimeDesc(items).slice(0, 8);
    $('#home-list').innerHTML = Views.renderList(
      latest,
      '还没有任何信息',
      '点击右上角「发布信息」，成为第一个发布的人吧'
    );
  }

  /**
   * 数字滚动动画。纯视觉效果，不参与业务逻辑。
   */
  function animateNumber(el, from, to, isPercent) {
    var start = null, dur = 620;
    function step(ts) {
      if (!start) { start = ts; }
      var p = Math.min((ts - start) / dur, 1);
      var eased = 1 - Math.pow(1 - p, 3);
      var cur = Math.round(from + (to - from) * eased);
      el.textContent = isPercent ? cur + '%' : cur;
      if (p < 1) { requestAnimationFrame(step); }
    }
    requestAnimationFrame(step);
  }

  /* ------------------------------------------------------------------ */
  /* 渲染：浏览 / 搜索                                                   */
  /* ------------------------------------------------------------------ */

  function renderBrowse() {
    var query = {
      keyword: $('#browse-keyword').value,
      type: ($('#type-tabs .tab.is-active') || {}).getAttribute
        ? $('#type-tabs .tab.is-active').getAttribute('data-type') : '',
      category: $('#browse-category').value,
      status: $('#browse-status').value
    };

    var result = Store.searchItems(Store.load(), query);
    result = Store.sortByTimeDesc(result);

    $('#browse-list').innerHTML = Views.renderList(
      result,
      '没有匹配的信息',
      '试试更换关键词，或点击「重置」查看全部内容'
    );
    $('#browse-count').textContent =
      '共找到 ' + result.length + ' 条信息' + (query.keyword ? '（关键词：' + query.keyword + '）' : '');
  }

  /* ------------------------------------------------------------------ */
  /* 渲染：看板                                                          */
  /* ------------------------------------------------------------------ */

  function renderDashboard() {
    var stats = Store.calcStats(Store.load());
    $('#dashboard-stats').innerHTML = Views.renderStatCards(stats);
    $('#chart-days').innerHTML = Views.renderDayChart(stats.last7Days);
    $('#chart-category').innerHTML = Views.renderCategoryChart(stats.byCategory);
  }

  /* ------------------------------------------------------------------ */
  /* 渲染：我的发布                                                      */
  /* ------------------------------------------------------------------ */

  function renderMine() {
    var items = Store.sortByTimeDesc(Store.load());
    $('#mine-list').innerHTML = Views.renderMineList(items);
  }

  /* ------------------------------------------------------------------ */
  /* 详情抽屉                                                            */
  /* ------------------------------------------------------------------ */

  function openDetail(id) {
    var item = Store.findById(Store.load(), id);
    if (!item) { toast('该信息已不存在', 'error'); return; }
    currentDetailId = id;
    phoneRevealed = false;
    $('#drawer-body').innerHTML = Views.renderDetail(item, { maskedPhone: true });
    $('#drawer').classList.add('is-open');
    $('#drawer-mask').classList.add('is-open');
  }

  function closeDetail() {
    $('#drawer').classList.remove('is-open');
    $('#drawer-mask').classList.remove('is-open');
    currentDetailId = null;
  }

  /**
   * 重新渲染当前抽屉（状态更新后调用）。
   */
  function refreshDetail() {
    if (!currentDetailId) { return; }
    var item = Store.findById(Store.load(), currentDetailId);
    if (!item) { closeDetail(); return; }
    $('#drawer-body').innerHTML = Views.renderDetail(item, { maskedPhone: !phoneRevealed });
  }

  /* ------------------------------------------------------------------ */
  /* 发布表单                                                            */
  /* ------------------------------------------------------------------ */

  /**
   * 填充类别下拉框（发布页 + 筛选器共用同一份类别常量）。
   */
  function fillCategoryOptions() {
    var opts = Data.CATEGORIES.map(function (c) {
      return '<option value="' + c + '">' + c + '</option>';
    }).join('');
    $('#f-category').innerHTML = '<option value="">请选择类别</option>' + opts;
    $('#browse-category').innerHTML = '<option value="">全部类别</option>' + opts;
  }

  /**
   * 切换发布类型（寻物 / 招领）。
   * @param {string} type lost | found
   */
  function setType(type) {
    $('#f-type').value = type;
    $$('#type-switch .type-option').forEach(function (el) {
      el.classList.toggle('is-active', el.getAttribute('data-type') === type);
    });
  }

  /** 清空表单所有错误提示与错误态 */
  function clearFormErrors() {
    $$('#publish-form .form-error').forEach(function (el) { el.textContent = ''; });
    $$('#publish-form .form-control').forEach(function (el) { el.classList.remove('has-error'); });
  }

  /**
   * 展示表单校验错误。
   * @param {Object} errors { 字段: 提示 }
   */
  function showFormErrors(errors) {
    clearFormErrors();
    Object.keys(errors).forEach(function (key) {
      var box = $('[data-error="' + key + '"]');
      if (box) { box.textContent = errors[key]; }
      var field = $('#f-' + key);
      if (field) { field.classList.add('has-error'); }
    });
  }

  /** 读取表单当前值 */
  function readForm() {
    return {
      type: $('#f-type').value,
      title: $('#f-title').value.trim(),
      category: $('#f-category').value,
      place: $('#f-place').value.trim(),
      date: $('#f-date').value,
      description: $('#f-desc').value.trim(),
      emoji: $('#f-emoji').value,
      name: $('#f-name').value.trim() || '热心同学',
      contact: {
        phone: $('#f-phone').value.trim(),
        im: $('#f-im').value.trim()
      }
    };
  }

  /** 重置表单到初始状态 */
  function resetForm() {
    $('#publish-form').reset();
    setType('lost');
    clearFormErrors();
    $('#f-date').value = Store.todayString();
    $('#f-date').max = Store.todayString();
  }

  /**
   * 提交发布表单。
   */
  function handleSubmit(e) {
    e.preventDefault();
    var data = readForm();
    var result = Store.validateItem(data);

    if (!result.valid) {
      showFormErrors(result.errors);
      toast('请检查表单中标红的内容', 'error');
      return;
    }

    Store.addItem(data);
    toast('发布成功！已加入失物招领列表 🎉', 'success');
    resetForm();
    setTimeout(function () { go('browse'); }, 700);
  }

  /* ------------------------------------------------------------------ */
  /* 状态更新                                                            */
  /* ------------------------------------------------------------------ */

  /**
   * 标记信息为已结束（已找到 / 已归还）。
   * @param {string} id
   */
  function markClosed(id) {
    var item = Store.findById(Store.load(), id);
    if (!item) { return; }
    if (item.status === 'closed') { toast('该信息已经是结束状态'); return; }

    var label = item.type === 'lost' ? '已找到' : '已归还';
    if (!global.confirm('确认将该信息标记为「' + label + '」吗？\n\n标记后信息仍会保留在列表中，但会显示为已结束状态。')) {
      return;
    }
    Store.save(Store.updateStatus(Store.load(), id, Store.STATUS.CLOSED));
    toast('已标记为「' + label + '」，恭喜 🎊', 'success');
    renderAll();
  }

  /**
   * 把已结束的信息重新标记为进行中（防止误操作）。
   * @param {string} id
   */
  function markReopen(id) {
    Store.save(Store.updateStatus(Store.load(), id, Store.STATUS.OPEN));
    toast('已重新标记为「进行中」');
    renderAll();
  }

  /**
   * 删除一条信息。
   * @param {string} id
   */
  function deleteItem(id) {
    var item = Store.findById(Store.load(), id);
    if (!item) { return; }
    if (!global.confirm('确认删除「' + item.title + '」这条信息吗？\n\n删除后不可恢复。')) { return; }
    Store.removeItem(id);
    if (currentDetailId === id) { closeDetail(); }
    toast('已删除', 'success');
    renderAll();
  }

  /** 刷新当前可见页面的数据 */
  function renderAll() {
    var active = $('.page.is-active');
    if (!active) { return; }
    var name = active.id.replace('page-', '');
    if (name === 'home') { renderHome(); }
    if (name === 'browse') { renderBrowse(); }
    if (name === 'dashboard') { renderDashboard(); }
    if (name === 'mine') { renderMine(); }
    if (currentDetailId) { refreshDetail(); }
  }

  /* ------------------------------------------------------------------ */
  /* 事件绑定                                                            */
  /* ------------------------------------------------------------------ */

  function bindEvents() {
    // —— 全局点击委托：所有 data-nav / data-action / 卡片点击 ——
    document.addEventListener('click', function (e) {
      var navEl = e.target.closest('[data-nav]');
      var actEl = e.target.closest('[data-action]');
      var card = e.target.closest('.item-card');
      var copyEl = e.target.closest('[data-copy]');

      // 1. 导航
      if (navEl) {
        e.preventDefault();
        var preset = navEl.getAttribute('data-preset');
        go(navEl.getAttribute('data-nav'));
        if (preset) { setType(preset); }
        return;
      }

      // 2. 复制联系方式（优先于卡片点击）
      if (copyEl) {
        e.stopPropagation();
        var raw = copyEl.getAttribute('data-copy');
        // 只有在「手机号 + 仍处脱敏状态」时，第一次点击才是展开而非复制。
        // 用 data-phone 属性显式判断，而不是用正则去猜原始值是不是手机号 ——
        // 后者会把「原始值恰好是 11 位数字的微信号」误判成手机号。
        var needReveal = copyEl.getAttribute('data-phone') === 'masked';
        if (needReveal) {
          phoneRevealed = true;
          refreshDetail();
          toast('已显示完整手机号，再次点击可复制');
        } else {
          copyText(raw);
        }
        return;
      }

      // 3. 操作按钮
      if (actEl) {
        e.stopPropagation();
        var action = actEl.getAttribute('data-action');
        var id = actEl.getAttribute('data-id') || currentDetailId;

        if (action === 'close') { markClosed(id); }
        else if (action === 'reopen') { markReopen(id); }
        else if (action === 'delete') { deleteItem(id); }
        else if (action === 'view') { openDetail(id); }
        else if (action === 'copy-phone') {
          var it = Store.findById(Store.load(), id);
          if (it && it.contact && it.contact.phone) { copyText(it.contact.phone); }
        } else if (action === 'copy-im') {
          var it2 = Store.findById(Store.load(), id);
          if (it2 && it2.contact && it2.contact.im) { copyText(it2.contact.im); }
        }
        return;
      }

      // 4. 卡片点击 -> 打开详情
      if (card) { openDetail(card.getAttribute('data-id')); }
    });

    // —— 抽屉关闭 ——
    $('#drawer-close').addEventListener('click', closeDetail);
    $('#drawer-mask').addEventListener('click', closeDetail);
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && currentDetailId) { closeDetail(); }
    });

    // —— 首页搜索：跳转到「全部信息」并带上关键词 ——
    $('#hero-search-form').addEventListener('submit', function (e) {
      e.preventDefault();
      var kw = $('#hero-search-input').value.trim();
      $('#browse-keyword').value = kw;
      go('browse');
    });

    // —— 浏览页筛选 ——
    $('#type-tabs').addEventListener('click', function (e) {
      var tab = e.target.closest('.tab');
      if (!tab) { return; }
      $$('#type-tabs .tab').forEach(function (t) { t.classList.remove('is-active'); });
      tab.classList.add('is-active');
      renderBrowse();
    });
    ['#browse-keyword', '#browse-category', '#browse-status'].forEach(function (sel) {
      $(sel).addEventListener('input', renderBrowse);
      $(sel).addEventListener('change', renderBrowse);
    });
    $('#browse-reset').addEventListener('click', function () {
      $('#browse-keyword').value = '';
      $('#browse-category').value = '';
      $('#browse-status').value = '';
      $$('#type-tabs .tab').forEach(function (t, i) { t.classList.toggle('is-active', i === 0); });
      renderBrowse();
      toast('已重置筛选条件');
    });

    // —— 发布表单 ——
    $('#type-switch').addEventListener('click', function (e) {
      var opt = e.target.closest('.type-option');
      if (opt) { setType(opt.getAttribute('data-type')); }
    });
    $('#publish-form').addEventListener('submit', handleSubmit);
    $('#publish-reset').addEventListener('click', function () {
      resetForm();
      toast('表单已清空');
    });

    // 输入时实时清除该字段的错误提示，提升填写体验
    $('#publish-form').addEventListener('input', function (e) {
      var box = e.target.closest('.form-row');
      if (box) {
        var err = box.querySelector('.form-error');
        if (err) { err.textContent = ''; }
        e.target.classList.remove('has-error');
      }
    });
  }

  /* ------------------------------------------------------------------ */
  /* 启动                                                               */
  /* ------------------------------------------------------------------ */

  function init() {
    // 首次访问注入示例数据（只注入一次）
    if (Store.load().length === 0) {
      Data.seedIfEmpty(Store);
    }

    fillCategoryOptions();
    resetForm();
    bindEvents();
    go('home');

    // 在控制台暴露核心模块，方便助教调试与手工验证
    global.LFApp = { go: go, renderAll: renderAll, openDetail: openDetail };
    console.log('%c福大拾光 · 校园失物招领已就绪', 'color:#6b4ee6;font-weight:bold;font-size:14px');
    console.log('调试入口：window.LFStore / window.LFViews / window.LFApp');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})(typeof window !== 'undefined' ? window : globalThis);
