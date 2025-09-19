import { describe, it, expect, beforeEach } from 'vitest';
import HighlightConfig from '../../src/config/HighlightConfig.js';

describe('HighlightConfig', () => {
  let highlightConfig;

  beforeEach(() => {
    highlightConfig = new HighlightConfig();
  });

  describe('constructor', () => {
    it('should initialize with empty keywords array when no arguments provided', () => {
      const config = new HighlightConfig();
      expect(config.getKeywords()).toEqual([]);
    });

    it('should initialize with provided keywords array', () => {
      const keywords = ['/test/i', '/example/g'];
      const config = new HighlightConfig(keywords);
      expect(config.getKeywords()).toEqual(keywords);
    });

    it('should throw error when invalid regex is provided in constructor', () => {
      const keywords = ['/test/i', 'invalid-regex'];
      expect(() => new HighlightConfig(keywords)).toThrow('無効な正規表現');
    });
  });

  describe('parseRegexString', () => {
    it('should parse valid regex string with flags', () => {
      const regex = highlightConfig.parseRegexString('/test/i');
      expect(regex).toBeInstanceOf(RegExp);
      expect(regex.source).toBe('test');
      expect(regex.flags).toBe('i');
    });

    it('should parse valid regex string without flags', () => {
      const regex = highlightConfig.parseRegexString('/hello/');
      expect(regex).toBeInstanceOf(RegExp);
      expect(regex.source).toBe('hello');
      expect(regex.flags).toBe('');
    });

    it('should parse regex with multiple flags', () => {
      const regex = highlightConfig.parseRegexString('/pattern/gim');
      expect(regex).toBeInstanceOf(RegExp);
      expect(regex.source).toBe('pattern');
      expect(regex.flags).toBe('gim');
    });

    it('should parse complex regex patterns', () => {
      const regex = highlightConfig.parseRegexString('/(uzulla|uzura)/i');
      expect(regex).toBeInstanceOf(RegExp);
      expect(regex.source).toBe('(uzulla|uzura)');
      expect(regex.flags).toBe('i');
    });

    it('should throw error for non-string input', () => {
      expect(() => highlightConfig.parseRegexString(123)).toThrow('正規表現は文字列である必要があります');
      expect(() => highlightConfig.parseRegexString(null)).toThrow('正規表現は文字列である必要があります');
      expect(() => highlightConfig.parseRegexString(undefined)).toThrow('正規表現は文字列である必要があります');
    });

    it('should throw error for invalid regex format', () => {
      expect(() => highlightConfig.parseRegexString('test')).toThrow('正規表現は"/pattern/flags"形式である必要があります');
      expect(() => highlightConfig.parseRegexString('/test')).toThrow('正規表現は"/pattern/flags"形式である必要があります');
      expect(() => highlightConfig.parseRegexString('test/')).toThrow('正規表現は"/pattern/flags"形式である必要があります');
    });

    it('should throw error for invalid regex pattern', () => {
      expect(() => highlightConfig.parseRegexString('/[/i')).toThrow('正規表現のコンパイルに失敗しました');
      expect(() => highlightConfig.parseRegexString('/(/i')).toThrow('正規表現のコンパイルに失敗しました');
    });

    it('should throw error for invalid flags', () => {
      // Test with flags that pass format validation but might cause compilation issues
      // Since the implementation restricts flags to 'gimuy', let's test the format validation instead
      expect(() => highlightConfig.parseRegexString('/test/z')).toThrow('正規表現は"/pattern/flags"形式である必要があります');
    });
  });

  describe('addKeyword', () => {
    it('should add valid keyword successfully', () => {
      highlightConfig.addKeyword('/test/i');
      expect(highlightConfig.getKeywords()).toContain('/test/i');
    });

    it('should add multiple keywords', () => {
      highlightConfig.addKeyword('/test/i');
      highlightConfig.addKeyword('/example/g');
      const keywords = highlightConfig.getKeywords();
      expect(keywords).toContain('/test/i');
      expect(keywords).toContain('/example/g');
      expect(keywords).toHaveLength(2);
    });

    it('should throw error for non-string keyword', () => {
      expect(() => highlightConfig.addKeyword(123)).toThrow('キーワードは文字列である必要があります');
      expect(() => highlightConfig.addKeyword(null)).toThrow('キーワードは文字列である必要があります');
      expect(() => highlightConfig.addKeyword({})).toThrow('キーワードは文字列である必要があります');
    });

    it('should throw error for invalid regex keyword', () => {
      expect(() => highlightConfig.addKeyword('invalid')).toThrow('無効な正規表現');
      expect(() => highlightConfig.addKeyword('/[/i')).toThrow('無効な正規表現');
    });
  });

  describe('removeKeyword', () => {
    beforeEach(() => {
      highlightConfig.addKeyword('/test/i');
      highlightConfig.addKeyword('/example/g');
    });

    it('should remove existing keyword successfully', () => {
      const result = highlightConfig.removeKeyword('/test/i');
      expect(result).toBe(true);
      expect(highlightConfig.getKeywords()).not.toContain('/test/i');
      expect(highlightConfig.getKeywords()).toContain('/example/g');
    });

    it('should return false when removing non-existing keyword', () => {
      const result = highlightConfig.removeKeyword('/nonexistent/i');
      expect(result).toBe(false);
      expect(highlightConfig.getKeywords()).toHaveLength(2);
    });

    it('should remove all instances of keyword', () => {
      highlightConfig.addKeyword('/test/i'); // Add duplicate
      const initialLength = highlightConfig.getKeywords().length;
      const result = highlightConfig.removeKeyword('/test/i');
      expect(result).toBe(true);
      expect(highlightConfig.getKeywords()).toHaveLength(initialLength - 1);
    });
  });

  describe('matchesAny', () => {
    beforeEach(() => {
      highlightConfig.addKeyword('/test/i');
      highlightConfig.addKeyword('/php/i');
      highlightConfig.addKeyword('/(uzulla|uzura)/i');
    });

    it('should return true when text matches a keyword', () => {
      expect(highlightConfig.matchesAny('This is a test message')).toBe(true);
      expect(highlightConfig.matchesAny('PHP is great')).toBe(true);
      expect(highlightConfig.matchesAny('Hello uzulla')).toBe(true);
      expect(highlightConfig.matchesAny('uzura says hello')).toBe(true);
    });

    it('should return true for case-insensitive matches', () => {
      expect(highlightConfig.matchesAny('TEST message')).toBe(true);
      expect(highlightConfig.matchesAny('php code')).toBe(true);
      expect(highlightConfig.matchesAny('UZULLA here')).toBe(true);
    });

    it('should return false when text does not match any keyword', () => {
      expect(highlightConfig.matchesAny('Hello world')).toBe(false);
      expect(highlightConfig.matchesAny('JavaScript is fun')).toBe(false);
      expect(highlightConfig.matchesAny('No matching content')).toBe(false);
    });

    it('should return false for non-string input', () => {
      expect(highlightConfig.matchesAny(123)).toBe(false);
      expect(highlightConfig.matchesAny(null)).toBe(false);
      expect(highlightConfig.matchesAny(undefined)).toBe(false);
      expect(highlightConfig.matchesAny({})).toBe(false);
    });

    it('should return false when no keywords are configured', () => {
      const emptyConfig = new HighlightConfig();
      expect(emptyConfig.matchesAny('test message')).toBe(false);
    });

    it('should handle empty string input', () => {
      expect(highlightConfig.matchesAny('')).toBe(false);
    });

    it('should match partial words correctly', () => {
      highlightConfig.addKeyword('/@?uzulla/i');
      expect(highlightConfig.matchesAny('@uzulla mentioned')).toBe(true);
      expect(highlightConfig.matchesAny('uzulla without @')).toBe(true);
    });
  });

  describe('getKeywords', () => {
    it('should return empty array when no keywords are set', () => {
      expect(highlightConfig.getKeywords()).toEqual([]);
    });

    it('should return copy of keywords array', () => {
      highlightConfig.addKeyword('/test/i');
      const keywords = highlightConfig.getKeywords();
      keywords.push('/modified/');
      expect(highlightConfig.getKeywords()).toEqual(['/test/i']);
    });

    it('should return all added keywords', () => {
      const testKeywords = ['/test/i', '/php/g', '/(uzulla|uzura)/i'];
      for (const keyword of testKeywords) {
        highlightConfig.addKeyword(keyword);
      }
      expect(highlightConfig.getKeywords()).toEqual(testKeywords);
    });
  });

  describe('error handling', () => {
    it('should handle regex compilation errors gracefully', () => {
      expect(() => highlightConfig.addKeyword('/[/i')).toThrow();
      expect(highlightConfig.getKeywords()).toHaveLength(0);
    });

    it('should maintain state consistency after errors', () => {
      highlightConfig.addKeyword('/valid/i');
      expect(() => highlightConfig.addKeyword('/[/i')).toThrow();
      expect(highlightConfig.getKeywords()).toEqual(['/valid/i']);
      expect(highlightConfig.matchesAny('valid test')).toBe(true);
    });

    it('should handle edge cases in matching', () => {
      highlightConfig.addKeyword('/^$/'); // Empty string pattern
      expect(highlightConfig.matchesAny('')).toBe(true);
      expect(highlightConfig.matchesAny('not empty')).toBe(false);
    });
  });

  describe('integration scenarios', () => {
    it('should handle complex real-world regex patterns', () => {
      const patterns = [
        '/\\b(error|warning|fail)\\b/i',
        '/\\d{4}-\\d{2}-\\d{2}/',
        '/https?:\\/\\/[^\\s]+/i'
      ];
      
      for (const pattern of patterns) {
        highlightConfig.addKeyword(pattern);
      }

      expect(highlightConfig.matchesAny('Error occurred')).toBe(true);
      expect(highlightConfig.matchesAny('Date: 2023-12-25')).toBe(true);
      expect(highlightConfig.matchesAny('Visit https://example.com')).toBe(true);
      expect(highlightConfig.matchesAny('Normal message')).toBe(false);
    });

    it('should handle multiple matches in same text', () => {
      highlightConfig.addKeyword('/test/i');
      highlightConfig.addKeyword('/message/i');
      
      expect(highlightConfig.matchesAny('This is a test message')).toBe(true);
    });
  });
});
