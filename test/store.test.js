/**
 * test/store.test.js —— 单元测试用例
 *
 * 测试对象：js/store.js 中的核心业务函数（纯逻辑层）
 * 测试框架：Mocha（用例组织 + 断言运行器）+ Chai（expect 断言风格）
 *
 * 为什么选择测试 store.js 而不是测 DOM？
 *   store.js 是整个项目的业务核心：搜索、筛选、状态流转、统计、表单校验
 *   全部收敛在这里。它不依赖 DOM，是典型的「纯函数集合」，最适合做单元测试。
 *   视图层（views.js）只做字符串拼接，属于表现层，更适合用人工/端到端验证。
 *
 * 运行方式：
 *   A. 浏览器方式（推荐，零环境依赖）：用谷歌浏览器打开 test/test.html
 *   B. 命令行方式：npm install && npm test
 */

/* ---------- 环境适配：浏览器 / Node 双兼容 ---------- */

var Store, Data, expect, assert, testItems;

if (typeof window !== 'undefined') {
  // 浏览器环境：由 test.html 通过 <script> 提前引入
  Store = window.LFStore;
  Data = window.LFData;
  expect = window.chai.expect;
  assert = window.chai.assert;
} else {
  // Node 环境（命令行 npm test）
  Store = require('../js/store.js');
  Data = require('../js/data.js');
  var chai = require('chai');
  expect = chai.expect;
  assert = chai.assert;
  // Node 下补一个 localStorage 的最小实现，让 store 的读写函数可测
  if (typeof global.localStorage === 'undefined') {
    var _mem = {};
    global.localStorage = {
      getItem: function (k) { return Object.prototype.hasOwnProperty.call(_mem, k) ? _mem[k] : null; },
      setItem: function (k, v) { _mem[k] = String(v); },
      removeItem: function (k) { delete _mem[k]; },
      clear: function () { _mem = {}; }
    };
  }
}

/**
 * 构造测试数据。
 * 设计思路（见博客「构造测试数据的思路」一节）：
 *   刻意覆盖边界情况 —— 状态既有 open 也有 closed；类型既有 lost 也有 found；
 *   类别有重复也有独有；时间跨度覆盖 7 天内与 7 天外；描述含英文大小写混排，
 *   用于验证搜索的大小写不敏感特性。
 */
function buildTestItems() {
  var today = new Date();
  function iso(daysAgo) {
    var d = new Date(today.getTime() - daysAgo * 86400000);
    return d.toISOString();
  }
  function dateStr(daysAgo) { return iso(daysAgo).slice(0, 10); }

  return [
    {
      id: 'T1', type: 'lost', title: '校园卡', category: '证件卡类', emoji: '💳',
      place: '图书馆三楼', date: dateStr(1), description: '蓝色卡套，学号 2023 开头',
      contact: { phone: '13800000001', im: 'user_t1' }, name: '甲',
      status: 'open', createdAt: iso(1), statusUpdatedAt: null
    },
    {
      id: 'T2', type: 'found', title: 'AirPods 耳机', category: '耳机音响', emoji: '🎧',
      place: '紫金楼 201', date: dateStr(2), description: '白色，盒盖写有字母 Z',
      contact: { phone: '13800000002', im: 'user_t2' }, name: '乙',
      status: 'closed', createdAt: iso(2), statusUpdatedAt: iso(1)
    },
    {
      id: 'T3', type: 'lost', title: '黑色雨伞', category: '服饰穿戴', emoji: '🌂',
      place: '第三食堂门口', date: dateStr(3), description: '伞骨变形，挂云朵挂件',
      contact: { phone: '13800000003', im: '' }, name: '丙',
      status: 'open', createdAt: iso(3), statusUpdatedAt: null
    },
    {
      id: 'T4', type: 'found', title: '宿舍钥匙', category: '钥匙门禁', emoji: '🔑',
      place: '12 号楼门口', date: dateStr(5), description: '挂蓝色恐龙挂饰，两把钥匙',
      contact: { phone: '', im: 'wechat_t4' }, name: '丁',
      status: 'closed', createdAt: iso(5), statusUpdatedAt: iso(4)
    },
    {
      id: 'T5', type: 'lost', title: '考研英语真题', category: '书籍资料', emoji: '📚',
      place: '图书馆二楼', date: dateStr(8), description: '黄皮书，有大量铅笔笔记',
      contact: { phone: '13800000005', im: 'user_t5' }, name: '戊',
      status: 'open', createdAt: iso(8), statusUpdatedAt: null
    }
  ];
}

testItems = buildTestItems();

/* =================================================================== */
/* 用例 1：搜索 —— 关键词命中标题                                          */
/* =================================================================== */
describe('【搜索】searchItems - 关键词匹配', function () {

  it('用例1：应能按物品名称精确命中（关键词「校园卡」）', function () {
    var result = Store.searchItems(testItems, { keyword: '校园卡' });
    expect(result).to.be.an('array');
    expect(result).to.have.lengthOf(1);
    expect(result[0].id).to.equal('T1');
  });

  it('用例2：应能匹配详细描述中的文字（关键词「挂件」跨多条命中）', function () {
    // T3 描述含「云朵挂件」，T4 描述含「恐龙挂饰」——用「挂」字可同时命中两条，
    // 这也侧面验证了搜索是在描述字段上做子串匹配而非仅匹配标题。
    var result = Store.searchItems(testItems, { keyword: '挂' });
    expect(result).to.have.lengthOf(2);
    var ids = result.map(function (i) { return i.id; });
    expect(ids).to.include('T3');
    expect(ids).to.include('T4');
  });

  it('用例2b：关键词只出现在描述中（不出现在标题/地点）时也应命中', function () {
    var result = Store.searchItems(testItems, { keyword: '恐龙' });   // 仅 T4 描述里有
    expect(result).to.have.lengthOf(1);
    expect(result[0].id).to.equal('T4');
  });

  it('用例3：应能匹配地点字段（关键词「图书馆」）', function () {
    var result = Store.searchItems(testItems, { keyword: '图书馆' });
    expect(result).to.have.lengthOf(2);   // T1 图书馆三楼 / T5 图书馆二楼
  });

  it('用例4：英文关键词应大小写不敏感（「airpods」应命中「AirPods」）', function () {
    var lower = Store.searchItems(testItems, { keyword: 'airpods' });
    var upper = Store.searchItems(testItems, { keyword: 'AIRPODS' });
    var mixed = Store.searchItems(testItems, { keyword: 'AiRpOdS' });
    expect(lower).to.have.lengthOf(1);
    expect(upper).to.have.lengthOf(1);
    expect(mixed).to.have.lengthOf(1);
    expect(lower[0].id).to.equal('T2');
  });

  it('用例5：关键词首尾含空格时应自动 trim 后正常搜索', function () {
    var result = Store.searchItems(testItems, { keyword: '   雨伞   ' });
    expect(result).to.have.lengthOf(1);
    expect(result[0].id).to.equal('T3');
  });

  it('用例6：边界 —— 空关键词应返回全部数据', function () {
    var result = Store.searchItems(testItems, { keyword: '' });
    expect(result).to.have.lengthOf(testItems.length);
  });

  it('用例7：边界 —— 无匹配关键词应返回空数组（而非 null/undefined）', function () {
    var result = Store.searchItems(testItems, { keyword: '这个关键词一定搜不到xyz' });
    expect(result).to.be.an('array');
    expect(result).to.have.lengthOf(0);
  });

  it('用例8：数据源为空数组或非法入参时，应安全返回空数组', function () {
    expect(Store.searchItems([], { keyword: '任意' })).to.have.lengthOf(0);
    expect(Store.searchItems(null, { keyword: '任意' })).to.have.lengthOf(0);
    expect(Store.searchItems(undefined, {})).to.have.lengthOf(0);
  });
});

/* =================================================================== */
/* 用例 2：筛选 —— 类型 / 类别 / 状态组合                                  */
/* =================================================================== */
describe('【筛选】searchItems - 多条件组合', function () {

  it('用例9：按类型筛选「寻物」应只返回 lost', function () {
    var result = Store.searchItems(testItems, { type: 'lost' });
    expect(result).to.have.lengthOf(3);   // T1 T3 T5
    result.forEach(function (i) { expect(i.type).to.equal('lost'); });
  });

  it('用例10：按类型筛选「招领」应只返回 found', function () {
    var result = Store.searchItems(testItems, { type: 'found' });
    expect(result).to.have.lengthOf(2);   // T2 T4
    result.forEach(function (i) { expect(i.type).to.equal('found'); });
  });

  it('用例11：按类别筛选（「耳机音响」）应精确匹配', function () {
    var result = Store.searchItems(testItems, { category: '耳机音响' });
    expect(result).to.have.lengthOf(1);
    expect(result[0].id).to.equal('T2');
  });

  it('用例12：按状态筛选「已结束」应只返回 closed', function () {
    var result = Store.searchItems(testItems, { status: 'closed' });
    expect(result).to.have.lengthOf(2);   // T2 T4
    result.forEach(function (i) { expect(i.status).to.equal('closed'); });
  });

  it('用例13：关键词 + 类型 + 状态 三条件组合筛选', function () {
    var result = Store.searchItems(testItems, {
      keyword: '图书馆', type: 'lost', status: 'open'
    });
    expect(result).to.have.lengthOf(2);   // T1、T5 都满足
    result.forEach(function (i) {
      expect(i.type).to.equal('lost');
      expect(i.status).to.equal('open');
    });
  });

  it('用例14：组合条件互斥时应返回空数组', function () {
    // 关键词「校园卡」只属于 T1（open + lost），加上 found 条件必然为空
    var result = Store.searchItems(testItems, { keyword: '校园卡', type: 'found' });
    expect(result).to.have.lengthOf(0);
  });

  it('用例15：筛选不应修改原数组（纯函数特性验证）', function () {
    var snapshot = JSON.stringify(testItems);
    Store.searchItems(testItems, { type: 'lost' });
    expect(JSON.stringify(testItems)).to.equal(snapshot);
  });
});

/* =================================================================== */
/* 用例 3：状态更新                                                        */
/* =================================================================== */
describe('【状态更新】updateStatus', function () {

  it('用例16：应能把指定 id 的信息从 open 更新为 closed', function () {
    var updated = Store.updateStatus(testItems, 'T1', 'closed');
    var target = Store.findById(updated, 'T1');
    expect(target.status).to.equal('closed');
    expect(target.statusUpdatedAt).to.be.a('string');
  });

  it('用例17：更新状态时应保留其他字段不变（不可变更新验证）', function () {
    var updated = Store.updateStatus(testItems, 'T1', 'closed');
    var target = Store.findById(updated, 'T1');
    expect(target.title).to.equal('校园卡');
    expect(target.category).to.equal('证件卡类');
    expect(target.place).to.equal('图书馆三楼');
    expect(target.contact.phone).to.equal('13800000001');
  });

  it('用例18：不应修改原数组（避免视图层数据脏读）', function () {
    var originalStatus = Store.findById(testItems, 'T1').status;
    Store.updateStatus(testItems, 'T1', 'closed');
    expect(Store.findById(testItems, 'T1').status).to.equal(originalStatus);
  });

  it('用例19：只应更新目标 id，其他条目保持原状态', function () {
    var updated = Store.updateStatus(testItems, 'T1', 'closed');
    expect(Store.findById(updated, 'T2').status).to.equal('closed');  // 原本就是 closed
    expect(Store.findById(updated, 'T3').status).to.equal('open');    // 应保持不变
    expect(Store.findById(updated, 'T5').status).to.equal('open');
  });

  it('用例20：边界 —— 传入不存在的 id 时不应报错，原样返回', function () {
    var updated = Store.updateStatus(testItems, 'NOT_EXIST_ID', 'closed');
    expect(updated).to.have.lengthOf(testItems.length);
    expect(Store.findById(updated, 'T1').status).to.equal('open');
  });

  it('用例21：状态可以回滚（closed 重新标记为 open）', function () {
    var closed = Store.updateStatus(testItems, 'T2', 'closed');
    var reopened = Store.updateStatus(closed, 'T2', 'open');
    var target = Store.findById(reopened, 'T2');
    expect(target.status).to.equal('open');
    expect(target.statusUpdatedAt).to.equal(null);   // 回滚时应清空时间戳
  });

  it('用例22：传入空数组时应安全返回空数组', function () {
    expect(Store.updateStatus([], 'T1', 'closed')).to.have.lengthOf(0);
    expect(Store.updateStatus(null, 'T1', 'closed')).to.have.lengthOf(0);
  });
});

/* =================================================================== */
/* 用例 4：表单校验                                                        */
/* =================================================================== */
describe('【表单校验】validateItem', function () {

  /** 构造一份合法的基准数据，各用例只改动需要测试的字段 */
  function validData() {
    return {
      type: 'lost',
      title: '校园卡',
      category: '证件卡类',
      place: '图书馆三楼',
      date: Store.todayString(),
      contact: { phone: '13800000001', im: '' }
    };
  }

  it('用例23：完全合法的数据应通过校验', function () {
    var r = Store.validateItem(validData());
    expect(r.valid).to.equal(true);
    expect(r.errors).to.be.an('object');
    expect(Object.keys(r.errors)).to.have.lengthOf(0);
  });

  it('用例24：物品名称为空或过短（1 个字）应校验失败', function () {
    var d = validData(); d.title = '';
    expect(Store.validateItem(d).valid).to.equal(false);
    expect(Store.validateItem(d).errors).to.have.property('title');

    d.title = '卡';
    expect(Store.validateItem(d).valid).to.equal(false);
  });

  it('用例25：物品名称超过 30 字应校验失败', function () {
    var d = validData();
    d.title = new Array(32).join('测');   // 31 个字符
    var r = Store.validateItem(d);
    expect(r.valid).to.equal(false);
    expect(r.errors.title).to.contain('30');
  });

  it('用例26：类型非法（非 lost / found）应校验失败', function () {
    var d = validData(); d.type = 'unknown';
    var r = Store.validateItem(d);
    expect(r.valid).to.equal(false);
    expect(r.errors).to.have.property('type');
  });

  it('用例27：日期格式错误应校验失败', function () {
    var d = validData(); d.date = '2026/10/10';
    var r = Store.validateItem(d);
    expect(r.valid).to.equal(false);
    expect(r.errors).to.have.property('date');
  });

  it('用例28：日期晚于今天应校验失败（防止填写未来日期）', function () {
    var future = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);
    var d = validData(); d.date = future;
    var r = Store.validateItem(d);
    expect(r.valid).to.equal(false);
    expect(r.errors.date).to.contain('今天');
  });

  it('用例29：手机号格式错误且未填 IM 时应校验失败', function () {
    var d = validData();
    d.contact = { phone: '1234', im: '' };
    var r = Store.validateItem(d);
    expect(r.valid).to.equal(false);
    expect(r.errors).to.have.property('contact');
  });

  it('用例30：手机号非法但填写了合法 IM，应校验通过（二选一即可）', function () {
    var d = validData();
    d.contact = { phone: '', im: 'my_wechat_id' };
    expect(Store.validateItem(d).valid).to.equal(true);
  });

  it('用例31：多个字段同时错误时，应一次返回全部错误（便于一并标红）', function () {
    var r = Store.validateItem({
      type: '', title: '', category: '', place: '',
      date: '', contact: { phone: '', im: '' }
    });
    expect(r.valid).to.equal(false);
    ['type', 'title', 'category', 'place', 'date', 'contact'].forEach(function (k) {
      expect(r.errors).to.have.property(k);
    });
  });

  it('用例32：边界 —— 传入 null / undefined / 非对象时应安全返回失败', function () {
    expect(Store.validateItem(null).valid).to.equal(false);
    expect(Store.validateItem(undefined).valid).to.equal(false);
    expect(Store.validateItem('字符串').valid).to.equal(false);
  });
});

/* =================================================================== */
/* 用例 5：统计计算                                                        */
/* =================================================================== */
describe('【统计】calcStats', function () {

  it('用例33：应正确统计总数、寻物数、招领数', function () {
    var s = Store.calcStats(testItems);
    expect(s.total).to.equal(5);
    expect(s.lost).to.equal(3);
    expect(s.found).to.equal(2);
  });

  it('用例34：应正确统计已结束数与进行中数，两者之和等于总数', function () {
    var s = Store.calcStats(testItems);
    expect(s.closed).to.equal(2);
    expect(s.open).to.equal(3);
    expect(s.closed + s.open).to.equal(s.total);
  });

  it('用例35：找回率应为四舍五入后的整数百分比（2/5 -> 40%）', function () {
    var s = Store.calcStats(testItems);
    expect(s.closedRate).to.equal(40);
  });

  it('用例36：近 7 天统计应返回 7 个数据点，且日期递增', function () {
    var s = Store.calcStats(testItems);
    expect(s.last7Days).to.have.lengthOf(7);
    for (var i = 1; i < s.last7Days.length; i++) {
      expect(s.last7Days[i].date > s.last7Days[i - 1].date).to.equal(true);
    }
  });

  it('用例37：近 7 天统计应只包含 7 天内的数据（T5 在 8 天前，不计入）', function () {
    var s = Store.calcStats(testItems);
    var sum = s.last7Days.reduce(function (acc, d) { return acc + d.count; }, 0);
    // T1(1天) T2(2天) T3(3天) T4(5天) 共 4 条；T5 是 8 天前，应被排除
    expect(sum).to.equal(4);
  });

  it('用例38：类别分布应正确聚合，且各分类数量之和等于总数', function () {
    var s = Store.calcStats(testItems);
    expect(s.byCategory['证件卡类']).to.equal(1);
    expect(s.byCategory['耳机音响']).to.equal(1);
    var sum = Object.keys(s.byCategory).reduce(function (acc, k) {
      return acc + s.byCategory[k];
    }, 0);
    expect(sum).to.equal(s.total);
  });

  it('用例39：边界 —— 空数据时所有统计应为 0，且不出现除零 NaN', function () {
    var s = Store.calcStats([]);
    expect(s.total).to.equal(0);
    expect(s.closedRate).to.equal(0);
    expect(Number.isNaN(s.closedRate)).to.equal(false);
    expect(s.last7Days).to.have.lengthOf(7);
  });

  it('用例40：边界 —— 传入 null 时不应抛异常', function () {
    expect(function () { Store.calcStats(null); }).to.not.throw();
    expect(Store.calcStats(null).total).to.equal(0);
  });

  it('用例41：全部找回时找回率应为 100%', function () {
    var allClosed = testItems.map(function (i) {
      return Object.assign({}, i, { status: 'closed' });
    });
    expect(Store.calcStats(allClosed).closedRate).to.equal(100);
  });
});

/* =================================================================== */
/* 用例 6：工具函数                                                        */
/* =================================================================== */
describe('【工具函数】排序 / 查找 / 脱敏 / 日期差 / ID', function () {

  it('用例42：sortByTimeDesc 应按发布时间倒序（最新在前）', function () {
    var sorted = Store.sortByTimeDesc(testItems);
    for (var i = 1; i < sorted.length; i++) {
      var prev = new Date(sorted[i - 1].createdAt).getTime();
      var cur = new Date(sorted[i].createdAt).getTime();
      expect(prev >= cur).to.equal(true);
    }
    expect(sorted[0].id).to.equal('T1');   // T1 最新（1 天前）
  });

  it('用例43：sortByTimeDesc 不应修改原数组顺序', function () {
    var firstBefore = testItems[0].id;
    Store.sortByTimeDesc(testItems);
    expect(testItems[0].id).to.equal(firstBefore);
  });

  it('用例44：findById 应能正确查找，不存在时返回 null', function () {
    expect(Store.findById(testItems, 'T3').title).to.equal('黑色雨伞');
    expect(Store.findById(testItems, 'NO_SUCH_ID')).to.equal(null);
  });

  it('用例45：maskPhone 应把 11 位手机号中间四位打码', function () {
    expect(Store.maskPhone('13812345678')).to.equal('138****5678');
  });

  it('用例46：maskPhone 对非手机号输入应原样返回（不做错误截断）', function () {
    expect(Store.maskPhone('12345')).to.equal('12345');
    expect(Store.maskPhone('')).to.equal('');
    expect(Store.maskPhone(null)).to.equal('');
  });

  it('用例47：daysBetween 应正确计算两个日期相差的天数', function () {
    var today = new Date();
    var threeDaysAgo = new Date(today.getTime() - 3 * 86400000).toISOString().slice(0, 10);
    expect(Store.daysBetween(threeDaysAgo)).to.equal(3);
  });

  it('用例48：daysBetween 传入非法日期应安全返回 0（不返回 NaN）', function () {
    expect(Store.daysBetween('not-a-date')).to.equal(0);
    expect(Number.isNaN(Store.daysBetween(''))).to.equal(false);
  });

  it('用例49：generateId 应返回非空且唯一的字符串 ID', function () {
    var ids = {};
    for (var i = 0; i < 500; i++) {
      var id = Store.generateId();
      expect(id).to.be.a('string');
      expect(id.length).to.be.greaterThan(5);
      expect(ids[id]).to.equal(undefined);   // 无重复
      ids[id] = true;
    }
  });

  it('用例50：todayString 应返回符合 YYYY-MM-DD 格式的今天日期', function () {
    expect(Store.todayString()).to.match(/^\d{4}-\d{2}-\d{2}$/);
    var d = new Date();
    var expectStr = d.getFullYear() + '-' +
      String(d.getMonth() + 1).padStart(2, '0') + '-' +
      String(d.getDate()).padStart(2, '0');
    expect(Store.todayString()).to.equal(expectStr);
  });
});

/* =================================================================== */
/* 用例 7：本地存储持久化                                                  */
/* =================================================================== */
describe('【持久化】save / load / addItem / removeItem', function () {

  it('用例51：addItem 后应能从 localStorage 中读出该条记录', function () {
    localStorage.clear();
    var added = Store.addItem({
      type: 'lost', title: '测试物品', category: '其他物品',
      place: '测试地点', date: Store.todayString(),
      contact: { phone: '13800000009', im: '' }
    });
    expect(added.id).to.be.a('string');
    expect(added.status).to.equal('open');          // 新增默认进行中
    expect(added.createdAt).to.be.a('string');

    var list = Store.load();
    expect(list).to.have.lengthOf(1);
    expect(list[0].title).to.equal('测试物品');
  });

  it('用例52：removeItem 应只删除目标记录，其余保留', function () {
    localStorage.clear();
    var a = Store.addItem({ type: 'lost', title: '物品A', category: '其他物品', place: 'P', date: Store.todayString(), contact: { phone: '13800000001', im: '' } });
    var b = Store.addItem({ type: 'found', title: '物品B', category: '其他物品', place: 'P', date: Store.todayString(), contact: { phone: '13800000002', im: '' } });
    var left = Store.removeItem(a.id);
    expect(left).to.have.lengthOf(1);
    expect(left[0].id).to.equal(b.id);
  });

  it('用例53：数据应能跨「会话」持久化 —— 写入后再 load 内容一致', function () {
    localStorage.clear();
    Store.addItem({ type: 'found', title: '持久化物品', category: '其他物品', place: 'P', date: Store.todayString(), contact: { phone: '13800000003', im: '' } });
    var firstRead = Store.load();
    var secondRead = Store.load();       // 模拟第二次访问
    expect(JSON.stringify(firstRead)).to.equal(JSON.stringify(secondRead));
  });

  it('用例54：localStorage 内容损坏时应降级为空数组而不抛异常', function () {
    localStorage.setItem(Store.STORAGE_KEY, '{这不是合法的JSON');
    expect(function () { Store.load(); }).to.not.throw();
    expect(Store.load()).to.have.lengthOf(0);
  });

  it('用例55：仓库初始为空时 load 应返回空数组', function () {
    localStorage.clear();
    expect(Store.load()).to.have.lengthOf(0);
  });
});

/* =================================================================== */
/* 用例 8：示例数据完整性                                                  */
/* =================================================================== */
describe('【示例数据】data.js 数据质量', function () {

  it('用例56：预置类别列表应非空且无重复项', function () {
    expect(Data.CATEGORIES.length).to.be.greaterThan(0);
    var set = {};
    Data.CATEGORIES.forEach(function (c) {
      expect(set[c]).to.equal(undefined);
      set[c] = true;
    });
  });

  it('用例57：每条示例数据的类别都应存在于类别常量表中', function () {
    Data.SEED_ITEMS.forEach(function (seed) {
      expect(Data.CATEGORIES).to.include(seed.category);
    });
  });

  it('用例58：每条示例数据的类型都应是合法的 lost / found', function () {
    Data.SEED_ITEMS.forEach(function (seed) {
      expect(['lost', 'found']).to.include(seed.type);
    });
  });

  it('用例59：示例数据应能通过表单校验（保证内置数据本身是合法的）', function () {
    Data.SEED_ITEMS.forEach(function (seed) {
      var r = Store.validateItem({
        type: seed.type, title: seed.title, category: seed.category,
        place: seed.place, date: Data.daysAgoDate(seed.daysAgo), contact: seed.contact
      });
      expect(r.valid, '示例数据「' + seed.title + '」校验失败：' + JSON.stringify(r.errors)).to.equal(true);
    });
  });

  it('用例60：示例数据数量应足够展示完整效果（不少于 8 条）', function () {
    expect(Data.SEED_ITEMS.length).to.be.at.least(8);
  });
});
