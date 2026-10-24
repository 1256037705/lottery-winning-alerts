'use client';
import { Alert, Card, Table } from 'antd';
import { Heading } from '@/components/common';
const ssq = [
  ['一等奖', '6 红 + 1 蓝', '浮动奖'],
  ['二等奖', '6 红', '浮动奖'],
  ['三等奖', '5 红 + 1 蓝', '以本期官方金额为准'],
  ['四等奖', '5 红 或 4 红 + 1 蓝', '以本期官方金额为准'],
  ['五等奖', '4 红 或 3 红 + 1 蓝', '以本期官方金额为准'],
  ['六等奖', '0–2 红 + 1 蓝', '以本期官方金额为准'],
  ['福运奖', '3 红 + 0 蓝', '须确认本期是否启动及官方金额'],
];
const dlt = [
  ['一等奖', '5 前 + 2 后', '浮动奖'],
  ['二等奖', '5 前 + 1 后', '浮动奖'],
  ['三等奖', '5 前 或 4 前 + 2 后', '以本期官方金额为准'],
  ['四等奖', '4 前 + 1 后', '以本期官方金额为准'],
  ['五等奖', '4 前 或 3 前 + 2 后', '以本期官方金额为准'],
  ['六等奖', '3 前 + 1 后 或 2 前 + 2 后', '以本期官方金额为准'],
  ['七等奖', '3 前；2 前 + 1 后；0–1 前 + 2 后', '以本期官方金额为准'],
];
export function Rules() {
  return (
    <>
      <Heading
        eyebrow="LOTTERY GUIDE"
        title="彩种与奖金规则"
        subtitle="当前支持单式基本投注；不支持复式、胆拖、追加或倍数。"
      />
      <Alert
        type="warning"
        showIcon
        title="奖金只使用本期官方奖级金额，不用旧期金额或固定估值替代。"
        description="金额为税前理论奖金，是否已购买及实际兑奖需自行核实。规则版本前的历史结果只展示，不自动判奖。"
        style={{ marginBottom: 24 }}
      />
      <div className="two-columns">
        {[
          {
            title: '双色球',
            description:
              '红球 1–33 选 6 个，蓝球 1–16 选 1 个；通常周二、周四、周日开奖。当前匹配规则从 2026-02-01 起适用。',
            rows: ssq,
            url: 'https://www.gdfc.org.cn/datas/content/content_280542.html?subjectID=14',
          },
          {
            title: '超级大乐透',
            description:
              '前区 1–35 选 5 个，后区 1–12 选 2 个；通常周一、周三、周六开奖。当前匹配规则从 2026-02-02 起适用。',
            rows: dlt,
            url: 'https://m.lottery.gov.cn/ksjz/m/yxgz_dlt/',
          },
        ].map((r) => (
          <Card title={r.title} key={r.title}>
            <p>{r.description}</p>
            <Table
              rowKey="tier"
              pagination={false}
              size="small"
              dataSource={r.rows.map(([tier, hits, prize]) => ({ tier, hits, prize }))}
              columns={[
                { title: '奖级', dataIndex: 'tier', width: 80 },
                { title: '命中规则', dataIndex: 'hits' },
                { title: '奖金', dataIndex: 'prize' },
              ]}
            />
            <p>
              <a href={r.url} target="_blank" rel="noreferrer" style={{ color: '#1677ff' }}>
                查看官方规则说明 ↗
              </a>
            </p>
          </Card>
        ))}
      </div>
      <Card title="业务口径" style={{ marginTop: 24 }}>
        <p>
          每注只按对应最高奖级统计一次，不重复累加多个奖级。每期
          21:30（上海时间）为本系统追踪快照截止点，不代表官方售票截止时间。休市或调整开奖日以官方公告为准。
        </p>
        <p>
          福运奖是否启用依据当期官方数据；缺少确认时标记“待官方确认”，不会误报 0
          元。普通中奖缺少奖金时也会等待数据补全。
        </p>
        <p>
          手动发送测试会取得官方可用的最新一期，邮件明确显示期号和日期；官方数据不可用时不以本地旧结果冒充最新一期。
        </p>
      </Card>
    </>
  );
}
