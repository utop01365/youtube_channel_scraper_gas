/**
 * メールアドレス抽出モジュール (GAS版)
 * テキストからメールアドレスを正規表現で抽出
 */

class EmailExtractor {
  constructor() {
    this.excludedDomains = new Set(EXCLUDED_DOMAINS);
  }

  /**
   * テキストから最初のメールアドレスを抽出
   * @param {string} text - 検索対象テキスト
   * @return {string|null} メールアドレス（見つからない場合はnull）
   */
  extract(text) {
    if (!text) {
      return null;
    }

    const matches = text.match(EMAIL_PATTERN);
    if (!matches) {
      return null;
    }

    for (const email of matches) {
      if (this.isValidEmail(email)) {
        return email.toLowerCase();
      }
    }

    return null;
  }

  /**
   * テキストから全てのメールアドレスを抽出
   * @param {string} text - 検索対象テキスト
   * @return {Array<string>} メールアドレスの配列
   */
  extractAll(text) {
    if (!text) {
      return [];
    }

    const matches = text.match(EMAIL_PATTERN);
    if (!matches) {
      return [];
    }

    const validEmails = [];
    const seen = new Set();

    for (const email of matches) {
      const lowerEmail = email.toLowerCase();
      if (this.isValidEmail(email) && !seen.has(lowerEmail)) {
        validEmails.push(lowerEmail);
        seen.add(lowerEmail);
      }
    }

    return validEmails;
  }

  /**
   * メールアドレスの妥当性チェック
   * @param {string} email - チェックするメールアドレス
   * @return {boolean} 妥当な場合true
   */
  isValidEmail(email) {
    if (!email || email.length < 5) {
      return false;
    }

    const parts = email.split('@');
    if (parts.length !== 2) {
      return false;
    }

    const [localPart, domain] = parts;

    // ローカル部分のチェック
    if (!localPart || localPart.length > 64) {
      return false;
    }

    // ドメイン部分のチェック
    if (!domain || domain.length > 255) {
      return false;
    }

    // 除外ドメインチェック
    if (this.excludedDomains.has(domain.toLowerCase())) {
      return false;
    }

    // ドメインにドットが含まれるかチェック
    if (!domain.includes('.')) {
      return false;
    }

    return true;
  }
}
