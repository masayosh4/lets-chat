class SpaceArray{
  static toString(val) {
    let val_str = '';
    if (Array.isArray(val)) {
      val.forEach((it) => {
        it = String(it);
        if (val_str) {
          val_str += ' ';
        }
        // 全角スペース以外のスペース
        val_str += it.replace(/\t\n\v\f\r \u00a0/g, '');
      });
    }
    return val_str;
  }

  static fromString(val) {
    if (!val) {
      return [];
    }
    return String(val).split(' ');
  }
}

module.exports = SpaceArray;
