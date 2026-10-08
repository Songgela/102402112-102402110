/**
 * views.js —— 视图渲染层
 *
 * 职责：把数据渲染成 HTML 片段。
 * 本层只负责「渲染」，不直接绑定事件（事件统一在 app.js 里做委托绑定），
 * 这样可以避免事件重复绑定，也让渲染函数保持纯粹的输入输出。
 */
(function (global) {
  'use strict';

  /**
   * HTML 转义，防止用户输入的内容破坏页面结构（XSS 防护）。
   * 虽然本项目为纯本地应用，但养成良好习惯。
   * @param {string} str
   * @returns {string}
   */
  function escapeHtml(str) {
    return String(str === undefined || str === null ? '' : str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  /**
   * 状态徽章 HTML。
   * @param {Object} item
   * @returns {string}
   */
  function statusBadge(item) {
    if (item.status === 'closed') {
      return '<span class="badge badge--closed">' +
        (item.type === 'lost' ? '已找到' : '已归还') + '</span>';
    }
    return '<span class="badge badge--' + item.type + '">' +
      (item.type === 'lost' ? '寻物' : '招领') + '</span>';
  }

  /**
   * 渲染单个物品卡片。
   * @param {Object} item
   * @returns {string} HTML 字符串
   */
  function renderCard(item) {
    var closed = item.status === 'closed';
    return [
      '<article class="item-card" data-id="' + escapeHtml(item.id) + '">',
      '  <div class="item-card__thumb">',
      '    <span>' + escapeHtml(item.emoji || '📦') + '</span>',
      statusBadge(item),
      '  </div>',
      '  <div class="item-card__body">',
      '    <h3 class="item-card__title">' + escapeHtml(item.title) + '</h3>',
      '    <p class="item-card__desc">' + escapeHtml(item.description || '暂无详细描述') + '</p>',
      '    <div class="item-card__meta">',
      '      <span class="chip">' + escapeHtml(item.category) + '</span>',
      '      <span>📍 ' + escapeHtml(item.place) + '</span>',
      '    </div>',
      '    <div class="item-card__meta" style="border:none;padding-top:6px">',
      '      <span>🕒 ' + escapeHtml(item.date) + '</span>',
      closed ? '<span class="badge--closed-inline">已结束</span>' : '<span>· 进行中</span>',
      '    </div>',
      '  </div>',
      '</article>'
    ].join('');
  }

  /**
   * 渲染卡片列表；数据为空时渲染空状态。
   * @param {Array}  items
   * @param {string} emptyTitle
   * @param {string} emptyDesc
   * @returns {string}
   */
  function renderList(items, emptyTitle, emptyDesc) {
    if (!items || items.length === 0) {
      return [
        '<div class="empty">',
        '  <div class="empty__icon">🔍</div>',
        '  <div class="empty__title">' + escapeHtml(emptyTitle || '没有找到相关信息') + '</div>',
        '  <div class="empty__desc">' + escapeHtml(emptyDesc || '换个关键词试试，或者去发布一条新的信息吧') + '</div>',
        '</div>'
      ].join('');
    }
    return items.map(renderCard).join('');
  }

  /**
   * 渲染详情抽屉内容。
   *
   * @param {Object} item
   * @param {Object} opts { maskedPhone: 是否脱敏显示手机号 }
   * @returns {string}
   */
  function renderDetail(item, opts) {
    opts = opts || {};
    var closed = item.status === 'closed';
    var statusText = closed ? (item.type === 'lost' ? '已找到' : '已归还') : '进行中';
    var statusColor = closed ? 'var(--closed)' : (item.type === 'lost' ? 'var(--lost)' : 'var(--found)');

    var phone = item.contact && item.contact.phone ? String(item.contact.phone) : '';
    var im = item.contact && item.contact.im ? String(item.contact.im) : '';
    var showPhone = opts.maskedPhone && phone ? global.LFStore.maskPhone(phone) : phone;

    var html = [
      '<div style="display:flex;align-items:center;gap:12px;margin-bottom:20px">',
      '  <div style="width:58px;height:58px;border-radius:14px;background:var(--bg);',
      '       display:grid;place-items:center;font-size:28px">' + escapeHtml(item.emoji || '📦') + '</div>',
      '  <div>',
      '    <div style="font-size:18px;font-weight:800">' + escapeHtml(item.title) + '</div>',
      '    <div style="font-size:12.5px;color:' + statusColor + ';font-weight:700">',
      '      ' + (item.type === 'lost' ? '🔎 寻物启事' : '🎁 招领启事') + ' · ' + statusText,
      '    </div>',
      '  </div>',
      '</div>',

      '<div class="detail-field">',
      '  <div class="detail-field__label">物品类别</div>',
      '  <div class="detail-field__value"><span class="chip">' + escapeHtml(item.category) + '</span></div>',
      '</div>',

      '<div class="detail-field">',
      '  <div class="detail-field__label">' + (item.type === 'lost' ? '丢失地点' : '拾取地点') + '</div>',
      '  <div class="detail-field__value">📍 ' + escapeHtml(item.place) + '</div>',
      '</div>',

      '<div class="detail-field">',
      '  <div class="detail-field__label">' + (item.type === 'lost' ? '丢失日期' : '拾取日期') + '</div>',
      '  <div class="detail-field__value">🕒 ' + escapeHtml(item.date) +
        '（' + global.LFStore.daysBetween(item.date) + ' 天前）</div>',
      '</div>',

      '<div class="detail-field">',
      '  <div class="detail-field__label">详细描述</div>',
      '  <div class="detail-desc">' + escapeHtml(item.description || '发布者未填写详细描述') + '</div>',
      '</div>',

      '<div class="detail-field">',
      '  <div class="detail-field__label">联系方式</div>',
      '  <div class="contact-box">'
    ];

    if (item.name) {
      html.push('<div class="contact-row"><span class="contact-row__label">联系人</span>' +
        '<span style="font-weight:700">' + escapeHtml(item.name) + '</span></div>');
    }
    if (im) {
      // 微信号：点击即复制（无隐私顾虑，直接明文显示）
      html.push('<div class="contact-row"><span class="contact-row__label">QQ / 微信</span>' +
        '<span class="contact-row__value" data-copy="' + escapeHtml(im) + '" title="点击复制">' +
        '💬 ' + escapeHtml(im) +
        ' <span style="font-size:11px;color:var(--primary)">点击复制</span></span></div>');
    }
    if (phone) {
      // 手机号：默认脱敏，data-phone="masked" 明确标记待展开状态，
      // 避免依赖「用正则猜原始值是不是手机号」这种脆弱的判断方式
      var phoneAttrs = 'data-copy="' + escapeHtml(phone) + '"' +
        (opts.maskedPhone ? ' data-phone="masked"' : ' data-phone="plain"') +
        ' title="点击复制"';
      html.push('<div class="contact-row"><span class="contact-row__label">手机号</span>' +
        '<span class="contact-row__value" ' + phoneAttrs + '>' +
        '📱 ' + escapeHtml(showPhone) +
        (opts.maskedPhone ? ' <span style="font-size:11px;color:var(--primary)">点击展开</span>' : '') +
        '</span></div>');
    }
    if (!im && !phone) {
      html.push('<div style="color:var(--text-mute);font-size:13px">发布者未留下联系方式</div>');
    }
    html.push('  </div>', '</div>');

    // —— 操作按钮区 ——
    html.push('<div style="display:flex;gap:10px;margin-top:22px;flex-wrap:wrap">');
    if (phone) {
      html.push('<button class="btn btn--primary btn--sm" data-action="copy-phone">📋 一键复制手机号</button>');
    }
    if (im) {
      html.push('<button class="btn btn--primary btn--sm" data-action="copy-im">📋 一键复制微信号</button>');
    }
    html.push('</div>');

    html.push('<div style="display:flex;gap:10px;margin-top:12px">');
    if (closed) {
      html.push('<button class="btn btn--ghost btn--block" data-action="reopen" data-id="' + escapeHtml(item.id) + '">',
        '↩️ 重新标记为进行中</button>');
    } else {
      html.push('<button class="btn btn--found btn--block" data-action="close" data-id="' + escapeHtml(item.id) + '">',
        item.type === 'lost' ? '✅ 我已找到，标记为已找到' : '✅ 已归还，标记为已归还', '</button>');
    }
    html.push('</div>');

    return html.join('');
  }

  /**
   * 渲染看板的四张统计卡。
   * @param {Object} stats
   * @returns {string}
   */
  function renderStatCards(stats) {
    var cards = [
      { label: '累计发布', value: stats.total, unit: '条', hint: '寻物 ' + stats.lost + ' · 招领 ' + stats.found },
      { label: '成功找回 / 归还', value: stats.closed, unit: '条', hint: '已结束的信息数量' },
      { label: '正在寻找', value: stats.open, unit: '条', hint: '等待好心人联系' },
      { label: '找回率', value: stats.closedRate, unit: '%', hint: '已结束 / 总发布' }
    ];
    return cards.map(function (c) {
      return [
        '<div class="stat-card">',
        '  <div class="stat-card__label">' + c.label + '</div>',
        '  <div class="stat-card__value">' + c.value +
             '<span class="stat-card__unit">' + c.unit + '</span></div>',
        '  <div class="stat-card__hint">' + c.hint + '</div>',
        '</div>'
      ].join('');
    }).join('');
  }

  /**
   * 渲染近 7 天柱状图（纯 CSS 实现，不引入图表库）。
   * @param {Array} days [{ date, count }]
   * @returns {string}
   */
  function renderDayChart(days) {
    var max = Math.max.apply(null, days.map(function (d) { return d.count; }).concat([1]));
    return days.map(function (d) {
      var height = d.count === 0 ? 4 : Math.round((d.count / max) * 140) + 8;
      var label = d.date.slice(5).replace('-', '/');
      return [
        '<div class="chart__col">',
        '  <div class="chart__num">' + d.count + '</div>',
        '  <div class="chart__bar" style="height:' + height + 'px"></div>',
        '  <div class="chart__label">' + label + '</div>',
        '</div>'
      ].join('');
    }).join('');
  }

  /**
   * 渲染类别分布横向条形图。
   * @param {Object} byCategory { 类别: 数量 }
   * @returns {string}
   */
  function renderCategoryChart(byCategory) {
    var entries = Object.keys(byCategory).map(function (k) {
      return { name: k, count: byCategory[k] };
    }).sort(function (a, b) { return b.count - a.count; });

    if (entries.length === 0) {
      return '<div style="color:var(--text-mute);font-size:13px;padding:10px 0">暂无数据</div>';
    }

    var max = Math.max.apply(null, entries.map(function (e) { return e.count; }));
    return entries.map(function (e) {
      var pct = Math.max(4, Math.round((e.count / max) * 100));
      return [
        '<div class="bar-row">',
        '  <div class="bar-row__name">' + escapeHtml(e.name) + '</div>',
        '  <div class="bar-row__track">',
        '    <div class="bar-row__fill" style="width:' + pct + '%"></div>',
        '  </div>',
        '  <div class="bar-row__count">' + e.count + '</div>',
        '</div>'
      ].join('');
    }).join('');
  }

  /**
   * 渲染「我的发布」列表项。
   * @param {Array} items
   * @returns {string}
   */
  function renderMineList(items) {
    if (!items || items.length === 0) {
      return [
        '<div class="empty">',
        '  <div class="empty__icon">📭</div>',
        '  <div class="empty__title">你还没有发布过信息</div>',
        '  <div class="empty__desc">点击右上角「发布信息」，帮助自己也帮助同学</div>',
        '</div>'
      ].join('');
    }
    return items.map(function (item) {
      var closed = item.status === 'closed';
      return [
        '<div class="my-item">',
        '  <div class="my-item__icon">' + escapeHtml(item.emoji || '📦') + '</div>',
        '  <div class="my-item__main">',
        '    <div class="my-item__title">' + escapeHtml(item.title) +
             ' <span class="chip">' + escapeHtml(item.category) + '</span></div>',
        '    <div class="my-item__meta">' +
             (item.type === 'lost' ? '🔎 寻物' : '🎁 招领') + ' · 📍 ' + escapeHtml(item.place) +
             ' · 🕒 ' + escapeHtml(item.date) + '</div>',
        '  </div>',
        '  <div class="my-item__actions">',
        closed
          ? '<span class="badge--closed-inline">' + (item.type === 'lost' ? '已找到' : '已归还') + '</span>'
          : '<button class="btn btn--found btn--sm" data-action="close" data-id="' + escapeHtml(item.id) + '">标记完成</button>',
        '    <button class="btn btn--ghost btn--sm" data-action="view" data-id="' + escapeHtml(item.id) + '">查看</button>',
        '    <button class="btn btn--danger btn--sm" data-action="delete" data-id="' + escapeHtml(item.id) + '">删除</button>',
        '  </div>',
        '</div>'
      ].join('');
    }).join('');
  }

  global.LFViews = {
    escapeHtml: escapeHtml,
    statusBadge: statusBadge,
    renderCard: renderCard,
    renderList: renderList,
    renderDetail: renderDetail,
    renderStatCards: renderStatCards,
    renderDayChart: renderDayChart,
    renderCategoryChart: renderCategoryChart,
    renderMineList: renderMineList
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = global.LFViews;
  }
})(typeof window !== 'undefined' ? window : globalThis);
