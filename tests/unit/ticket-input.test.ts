import { describe, expect, it } from 'vitest';
import { ballError, draftFromTicket, draftToTicket, emptyDraft, firstDraftError } from '../../src/modules/groups/ticket-input';

describe('圆形号码输入', () => {
  it('按彩种创建正确数量的红蓝区圆格', () => {
    expect(emptyDraft('SSQ').main).toHaveLength(6);
    expect(emptyDraft('SSQ').special).toHaveLength(1);
    expect(emptyDraft('DLT').main).toHaveLength(5);
    expect(emptyDraft('DLT').special).toHaveLength(2);
  });

  it('区分输入中、超范围、重复和缺失号码', () => {
    expect(ballError(['0'], 0, 33)).toBeNull();
    expect(ballError(['0'], 0, 33, true)).toBe('请输入两位数字');
    expect(ballError(['34'], 0, 33)).toBe('只能输入 01–33');
    expect(ballError(['01', '01'], 1, 33)).toBe('号码重复');
    expect(firstDraftError([emptyDraft('SSQ')], 'SSQ')).toMatchObject({
      ticket: 0,
      area: 'main',
      position: 0,
      error: '请输入号码',
    });
  });

  it('编辑时保留两位显示，提交前转换回整数号码', () => {
    const ticket = { main: [1, 2, 3, 4, 5], special: [6, 7] };
    const draft = draftFromTicket(ticket);
    expect(draft.main[0]).toBe('01');
    expect(firstDraftError([draft], 'DLT')).toBeNull();
    expect(draftToTicket(draft)).toEqual(ticket);
  });
});
