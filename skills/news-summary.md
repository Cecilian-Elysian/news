name: news-summary
description: 每日新闻总结生成工具，支持与昨日新闻进行对比分析
version: "1.0.0"

template:
  date: "[具体日期]"
  weekday: "[星期几]"
  generatedAt: "[具体时间]"

  overview:
    totalNews: "[具体数字]条"
    changeFromYesterday: "较昨日[增加/减少][具体数字]条"
    hotTopics:
      - "[领域1，如：科技·AI大模型更新]"
      - "[领域2，如：国际·中东局势]"
    keywords:
      - "[关键词1]"
      - "[关键词2]"
      - "[关键词3]"

  categories:
    - name: "[领域名称，如：国内时政]"
      count: "[具体数字]条"
      changeFromYesterday: "较昨日[增加/减少][具体数字]条"
      headline:
        title: "[标题]"
        content: "[1-2句话概括核心事件]"
        yesterdayComparison: "[说明与昨日相关事件的关联]"
      otherNews:
        - title: "[新闻标题]"
          content: "[核心内容]"

  yesterdayNewsProgress:
    - yesterdayTitle: "[昨日头条标题]"
      todayProgress: "[今日最新进展]"

  comparisonTable:
    headers:
      - dimension: "对比维度"
        today: "今日重点"
        yesterday: "昨日重点"
        change: "变化说明"
    rows:
      - dimension: "热点领域"
        today: "[今日热点领域及占比]"
        yesterday: "[昨日热点领域及占比]"
        change: "[变化说明]"
      - dimension: "核心事件"
        today: "[今日核心事件]"
        yesterday: "[昨日核心事件]"
        change: "[变化说明]"
      - dimension: "情绪倾向"
        today: "[今日情绪倾向及原因]"
        yesterday: "[昨日情绪倾向及原因]"
        change: "[变化说明]"

  tomorrowFocus:
    - "[关注点1]"
    - "[关注点2]"
    - "[关注点3]"

usage:
  dataSource: "通过新闻爬虫获取原始新闻，按领域分类后统计条数"
  yesterdayComparison: "需保存前一日新闻总结，提取头条、核心事件等关键信息进行对比"
  automationTip: "可结合AI工具生成核心内容摘要，用Excel或Notion制作对比表格"

customization:
  addOrRemoveCategories: true
  additionalDimensions:
    - "舆情热度"
    - "来源分布"
