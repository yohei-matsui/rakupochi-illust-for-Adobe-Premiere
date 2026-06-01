/**
 * host.jsx — ExtendScript (Premiere Pro ホスト側スクリプト)
 *
 * CEP パネルから CSInterface.evalScript() で呼び出す関数を定義します。
 * 現時点ではフォルダ操作を JS 側 (cep.fs) で完結させているため、
 * ここには将来の拡張用スタブのみ置いています。
 */

/**
 * アクティブなシーケンス名を返す（将来の連携用）
 */
function getActiveSequenceName() {
  try {
    var seq = app.project.activeSequence;
    return seq ? seq.name : "";
  } catch (e) {
    return "";
  }
}
