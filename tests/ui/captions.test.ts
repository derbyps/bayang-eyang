import { describe, expect, test } from 'vitest';
import { parseCaption } from '../../src/ui/caption-text';

describe('parseCaption', () => {
  test('splits out Javanese terms with their meaning', () => {
    expect(parseCaption('a [[sembah|a bow]] b')).toEqual([
      { text: 'a ' },
      { term: 'sembah', meaning: 'a bow' },
      { text: ' b' },
    ]);
  });

  test('keeps an unclosed marker as plain text', () => {
    expect(parseCaption('look [[x and more')).toEqual([{ text: 'look [[x and more' }]);
  });

  test('handles several terms and no surrounding text', () => {
    expect(parseCaption('[[kelir|the screen]][[blencong|the lamp]]')).toEqual([
      { term: 'kelir', meaning: 'the screen' },
      { term: 'blencong', meaning: 'the lamp' },
    ]);
  });
});
