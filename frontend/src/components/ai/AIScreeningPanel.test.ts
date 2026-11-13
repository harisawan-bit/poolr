import { describe, expect, it } from 'vitest';
import { aggregateResults } from './AIScreeningPanel';

const batch = [{ id: 'one' }];
const response = (content: string) => ({
  providerId: 'test', providerName: 'Test', model: 'model', content,
});

describe('AI screening response aggregation', () => {
  it('produces no decisions for failed, empty, malformed or unmatched provider replies', () => {
    expect(aggregateResults(batch, [])).toEqual([]);
    expect(aggregateResults(batch, [
      response(''), response('[]'), response('null'),
      response('[{"id":"other","decision":"include","confidence":1}]'),
      response('[{"id":"one","decision":"invalid","confidence":1}]'),
      response('[{"id":"one","decision":"include","confidence":2}]'),
    ])).toEqual([]);
  });

  it('uses valid decisions only and preserves zero confidence', () => {
    expect(aggregateResults(batch, [
      response(''),
      response('[{"id":"one","decision":"exclude","confidence":0}]'),
    ])).toMatchObject([{ id: 'one', consensus: 'exclude', avgConfidence: 0, agreement: 1 }]);
  });

  it('does not favor a provider when votes tie', () => {
    expect(aggregateResults(batch, [
      response('[{"id":"one","decision":"include","confidence":1}]'),
      response('[{"id":"one","decision":"exclude","confidence":1}]'),
    ])).toMatchObject([{ consensus: 'unsure', agreement: 0 }]);
  });
});
