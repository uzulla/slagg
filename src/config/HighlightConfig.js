/**
 * HighlightConfig - キーワード設定の管理と正規表現マッチング
 */
class HighlightConfig {
  /**
   * コンストラクタ
   * @param {string[]} keywords - 正規表現文字列の配列
   */
  constructor(keywords = []) {
    this.keywords = [];
    this.compiledRegexes = [];

    // キーワードを追加
    for (const keyword of keywords) {
      this.addKeyword(keyword);
    }
  }

  /**
   * キーワード（正規表現文字列）を追加
   * @param {string} pattern - 正規表現文字列（"/pattern/flags"形式）
   * @throws {Error} 無効な正規表現の場合
   */
  addKeyword(pattern) {
    if (typeof pattern !== 'string') {
      throw new Error('キーワードは文字列である必要があります');
    }

    try {
      const regex = this.parseRegexString(pattern);
      this.keywords.push(pattern);
      this.compiledRegexes.push(regex);
    } catch (error) {
      throw new Error(`無効な正規表現: ${pattern} - ${error.message}`);
    }
  }

  /**
   * キーワードを削除
   * @param {string} pattern - 削除する正規表現文字列
   * @returns {boolean} 削除に成功した場合true
   */
  removeKeyword(pattern) {
    const index = this.keywords.indexOf(pattern);
    if (index !== -1) {
      this.keywords.splice(index, 1);
      this.compiledRegexes.splice(index, 1);
      return true;
    }
    return false;
  }

  /**
   * テキストがいずれかのキーワードにマッチするかチェック
   * @param {string} text - チェック対象のテキスト
   * @returns {boolean} マッチした場合true
   */
  matchesAny(text) {
    if (typeof text !== 'string') {
      return false;
    }

    for (const regex of this.compiledRegexes) {
      if (regex.test(text)) {
        return true;
      }
    }
    return false;
  }

  /**
   * 設定されているキーワード一覧を取得
   * @returns {string[]} キーワード配列のコピー
   */
  getKeywords() {
    return [...this.keywords];
  }

  /**
   * "/pattern/flags"形式の文字列を正規表現オブジェクトに変換
   * @param {string} regexStr - 正規表現文字列
   * @returns {RegExp} 正規表現オブジェクト
   * @throws {Error} 無効な形式の場合
   */
  parseRegexString(regexStr) {
    if (typeof regexStr !== 'string') {
      throw new Error('正規表現は文字列である必要があります');
    }

    // "/pattern/flags"形式をパース
    const match = regexStr.match(/^\/(.+)\/([gimuy]*)$/);
    if (!match) {
      throw new Error('正規表現は"/pattern/flags"形式である必要があります');
    }

    const [, pattern, flags] = match;

    try {
      return new RegExp(pattern, flags);
    } catch (error) {
      throw new Error(`正規表現のコンパイルに失敗しました: ${error.message}`);
    }
  }
}

export default HighlightConfig;
