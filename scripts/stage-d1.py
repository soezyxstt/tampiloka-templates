"""Stage a frozen Wrangler D1 SQL export without firing application triggers."""
import argparse
import os
from pathlib import Path
import re
import sqlite3


def statements(sql):
    # A trigger body or string literal can contain several semicolons.
    start = 0
    for match in re.finditer(';', sql):
        end = match.end()
        if sqlite3.complete_statement(sql[start:end]):
            yield sql[start:end]
            start = end
    if strip_comments(sql[start:]).strip():
        raise ValueError('Incomplete SQL in D1 export')


def strip_comments(statement):
    return re.sub(r'^(?:\s+|--[^\n]*(?:\n|$)|/\*.*?\*/)*', '', statement, flags=re.S)


def ordered_dump(sql):
    tables, data, other = [], [], []
    for statement in statements(sql):
        s = strip_comments(statement).strip()
        # Wrangler can include optimizer statistics specific to the D1 SQLite build.
        if re.fullmatch(r'ANALYZE\s+sqlite_schema\s*;', s, re.I) or re.match(
            r'^INSERT\s+INTO\s+(?:"sqlite_stat[1-4]"|sqlite_stat[1-4])(?=\s|\()', s, re.I
        ):
            continue
        if re.match(r'^CREATE\s+TABLE\b', s, re.I):
            tables.append(s)
        elif re.match(r'^INSERT\s+INTO\b|^(?:DELETE FROM|UPDATE)\s+"?sqlite_sequence\b', s, re.I):
            data.append(s)
        elif re.match(r'^CREATE\s+(?:UNIQUE\s+)?(?:INDEX|TRIGGER|VIEW)\b', s, re.I):
            other.append(s)
        elif not re.fullmatch(r'(?:BEGIN(?: TRANSACTION)?|COMMIT|END(?: TRANSACTION)?|PRAGMA\s+(?:defer_foreign_keys|foreign_keys)\s*=\s*(?:ON|OFF|TRUE|FALSE|0|1))\s*;', s, re.I):
            raise ValueError('Unsupported statement in D1 export. Inspect the private snapshot.')
    return '\n'.join(tables + data + other)


def stage(dump, directory):
    directory.mkdir(mode=0o700)  # Never overwrite an earlier snapshot.
    script = ordered_dump(dump.read_text(encoding='utf-8'))
    db = sqlite3.connect(directory / 'source.sqlite')
    try:
        db.executescript('PRAGMA foreign_keys=ON; BEGIN; PRAGMA defer_foreign_keys=ON;\n' + script)
        if db.execute('PRAGMA foreign_key_check').fetchone() or db.execute('PRAGMA integrity_check').fetchall() != [('ok',)]:
            raise ValueError('Source snapshot failed SQLite integrity or foreign-key checks.')
        db.commit()
    finally:
        db.close()
    (directory / 'restore.sql').write_text(script, encoding='utf-8')


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('dump', type=Path)
    parser.add_argument('new_directory', type=Path)
    args = parser.parse_args()
    os.umask(0o077)
    stage(args.dump, args.new_directory)
    print('Staged and checked the D1 export.')
