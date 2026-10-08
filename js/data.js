/**
 * data.js —— 种子数据与常量配置
 *
 * 作用：
 *   1. 定义物品类别常量（供发布页下拉框、筛选器、看板共用）；
 *   2. 提供一批贴近福州大学校园生活的示例数据，首次访问时自动写入 localStorage。
 *
 * 为什么需要种子数据？
 *   本项目纯前端、无后端，若首次打开是空白页，助教与测试人员无法直观体验
 *   「浏览 / 搜索 / 筛选 / 详情 / 状态更新」的完整链路。因此在首次访问时注入
 *   一批示例数据，同时提供「清空数据」入口方便测试从零开始。
 */
(function (global) {
  'use strict';

  /** 物品类别：覆盖校园最常见的失物类型 */
  var CATEGORIES = [
    '证件卡类',   // 校园卡、身份证、学生证
    '电子设备',   // 手机、电脑、充电宝
    '耳机音响',   // 蓝牙耳机、有线耳机
    '包袋手提',   // 书包、手提袋、钱包
    '钥匙门禁',   // 宿舍钥匙、车钥匙、门禁卡
    '书籍资料',   // 教材、笔记本、四六级资料
    '服饰穿戴',   // 眼镜、手表、外套、雨伞
    '运动器材',   // 球拍、篮球、体测用品
    '其他物品'
  ];

  /**
   * 生成 N 天前的 ISO 时间字符串，用于构造示例数据的时间轴。
   * @param {number} daysAgo
   * @param {number} [hour]
   * @returns {string}
   */
  function daysAgoIso(daysAgo, hour) {
    var d = new Date();
    d.setDate(d.getDate() - daysAgo);
    d.setHours(hour === undefined ? 10 : hour, 20, 0, 0);
    return d.toISOString();
  }

  /**
   * 生成 YYYY-MM-DD 日期串。
   * @param {number} daysAgo
   * @returns {string}
   */
  function daysAgoDate(daysAgo) {
    return daysAgoIso(daysAgo).slice(0, 10);
  }

  /**
   * 示例数据模板。
   * 注意：id 在注入时动态生成，createdAt 根据 daysAgo 换算，
   * 这样无论何时打开页面，数据都呈现为「最近一周」的新鲜状态。
   */
  var SEED_ITEMS = [
    {
      type: 'lost', title: '校园卡（一卡通）', category: '证件卡类', emoji: '💳',
      place: '旗山校区 · 紫金楼 A 区 201 教室', daysAgo: 0,
      description: '学号 2023xxxx 的一卡通，卡面有轻微磨损，背面贴了一张小熊贴纸。\n周四下午在紫金楼上完高数后就找不到了，麻烦捡到的同学联系我，非常感谢！',
      contact: { phone: '13806012345', im: 'xiao_lin_2023' },
      name: '林同学', status: 'open'
    },
    {
      type: 'found', title: 'AirPods Pro 充电盒', category: '耳机音响', emoji: '🎧',
      place: '旗山校区 · 图书馆 4 楼自习区', daysAgo: 1,
      description: '白色 AirPods Pro 耳机盒，盒盖内侧用记号笔写了一个「周」字。\n昨天下午在图书馆四楼靠窗第三排座位捡到，已交至图书馆一楼服务台，请失主携带学生证前往认领。',
      contact: { phone: '13959102233', im: 'zhou_2022' },
      name: '周同学', status: 'open'
    },
    {
      type: 'lost', title: '黑色雨伞（自动折叠）', category: '服饰穿戴', emoji: '🌂',
      place: '旗山校区 · 第三食堂门口伞架', daysAgo: 2,
      description: '黑色全自动三折伞，伞骨有一根轻微变形，伞柄上挂了绿色的云朵挂件。\n周一中午在三餐吃饭时放在门口伞架，出来就没了，应该是被拿错了。',
      contact: { phone: '15060892345', im: 'yang_2021' },
      name: '杨同学', status: 'closed'
    },
    {
      type: 'found', title: '银色保温杯', category: '其他物品', emoji: '📦',
      place: '旗山校区 · 体育馆羽毛球场 3 号场', daysAgo: 3,
      description: '膳魔师银色保温杯，500ml，杯盖处有一道浅浅的划痕。\n周日晚上打羽毛球时留在场边，已带回宿舍代为保管，随时可以联系取回。',
      contact: { phone: '13759201188', im: 'chen_badminton' },
      name: '陈同学', status: 'closed'
    },
    {
      type: 'lost', title: '联想小新笔记本电脑充电器', category: '电子设备', emoji: '📱',
      place: '旗山校区 · 紫金楼 C 区机房', daysAgo: 3,
      description: '联想小新原装 65W 充电器，线材上用白色标签纸写了「张」字。\n周三晚上在 C 区机房上完实验课后忘记拔了，第二天去已经不见了，如果有同学看到请联系我。',
      contact: { phone: '13606071234', im: 'zhang_lab' },
      name: '张同学', status: 'open'
    },
    {
      type: 'found', title: '宿舍钥匙（挂卡通挂饰）', category: '钥匙门禁', emoji: '🔑',
      place: '旗山校区 · 学生公寓 12 号楼门口', daysAgo: 4,
      description: '一串两把钥匙，挂着一个蓝色恐龙公仔挂饰。\n周四晚上在 12 号楼门口地上捡到，已交给楼管阿姨，失主可直接去一楼值班室认领。',
      contact: { phone: '13905908877', im: 'wang_dorm12' },
      name: '王同学', status: 'open'
    },
    {
      type: 'lost', title: '考研英语真题册', category: '书籍资料', emoji: '📚',
      place: '旗山校区 · 图书馆 2 楼学习共享空间', daysAgo: 5,
      description: '《考研英语一历年真题解析》黄皮书，封面用透明胶带加固过，书内有大量铅笔笔记和荧光笔标注。\n这是我复习的全部心血，如果捡到请务必还给我，愿意适当酬谢！',
      contact: { phone: '18059801234', im: 'kaoyan_2026' },
      name: '考研人小李', status: 'closed'
    },
    {
      type: 'found', title: '粉色有线耳机', category: '耳机音响', emoji: '🎧',
      place: '旗山校区 · 生活区菜鸟驿站旁长椅', daysAgo: 5,
      description: '粉色 3.5mm 有线耳机，线长 1.2 米左右，收纳时绕成了一个小圈。\n周三傍晚在菜鸟驿站旁边的长椅上捡到，放在驿站前台了，认领时说明颜色即可。',
      contact: { phone: '15860209876', im: 'li_music' },
      name: '李同学', status: 'open'
    },
    {
      type: 'lost', title: '黑色双肩背包', category: '包袋手提', emoji: '🎒',
      place: '旗山校区 · 教学楼 B 区 305', daysAgo: 6,
      description: '黑色 30L 双肩包，前袋拉链上挂着一个银色小锁扣，内有一个蓝色笔袋和一本《数据结构》。\n周五下午上完课后落在教室了，回去看已经不在，教室里也没有同学留下。',
      contact: { phone: '13306082345', im: 'huang_cs' },
      name: '黄同学', status: 'open'
    },
    {
      type: 'found', title: '黑色全框眼镜', category: '服饰穿戴', emoji: '👓',
      place: '旗山校区 · 第三食堂二楼餐桌', daysAgo: 6,
      description: '黑色全框近视眼镜，镜腿内侧刻有度数 -4.50，配了一个深蓝色的硬质眼镜盒。\n周一午餐后在食堂二楼餐桌捡到，目前放在我宿舍，加微信约时间取即可。',
      contact: { phone: '15159601234', im: 'wu_glasses' },
      name: '吴同学', status: 'open'
    }
  ];

  var api = {
    CATEGORIES: CATEGORIES,
    SEED_ITEMS: SEED_ITEMS,
    daysAgoIso: daysAgoIso,
    daysAgoDate: daysAgoDate,

    /**
     * 首次访问时注入示例数据。
     * 通过 SEED_KEY 标记，保证只注入一次，不会覆盖用户自己发布的数据。
     *
     * @param {Object} store LFStore 模块
     */
    seedIfEmpty: function (store) {
      try {
        if (global.localStorage.getItem(store.SEED_KEY)) { return false; }
        var items = SEED_ITEMS.map(function (seed, index) {
          return {
            id: 'SEED' + String(index + 1).padStart(3, '0'),
            type: seed.type,
            title: seed.title,
            category: seed.category,
            emoji: seed.emoji,
            place: seed.place,
            date: daysAgoDate(seed.daysAgo),
            description: seed.description,
            contact: seed.contact,
            name: seed.name,
            status: seed.status,
            createdAt: daysAgoIso(seed.daysAgo, 9 + (index % 8)),
            statusUpdatedAt: seed.status === 'closed' ? daysAgoIso(Math.max(0, seed.daysAgo - 1)) : null
          };
        });
        store.save(items);
        global.localStorage.setItem(store.SEED_KEY, '1');
        return true;
      } catch (e) {
        console.warn('[data] 注入示例数据失败：', e);
        return false;
      }
    },

    /** 清除全部数据（含种子标记），供「清空数据」按钮调用 */
    resetAll: function (store) {
      try {
        global.localStorage.removeItem(store.STORAGE_KEY);
        global.localStorage.removeItem(store.SEED_KEY);
        return true;
      } catch (e) {
        return false;
      }
    }
  };

  global.LFData = api;
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
})(typeof window !== 'undefined' ? window : globalThis);
