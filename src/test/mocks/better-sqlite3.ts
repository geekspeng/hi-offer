// better-sqlite3 兼容层，基于 sql.js（纯 WASM SQLite）
// 让测试无需依赖原生模块即可运行
import initSqlJs from 'sql.js'

const SQL = await initSqlJs()

class Statement {
  constructor(private db: any, private sql: string) {}

  run(...params: any[]) {
    this.db.run(this.sql, params)
    return { changes: 0, lastInsertRowid: 0 }
  }

  get(...params: any[]) {
    const stmt = this.db.prepare(this.sql)
    if (params.length > 0) stmt.bind(params)
    const hasRow = stmt.step()
    const result = hasRow ? stmt.getAsObject() : undefined
    stmt.free()
    return result
  }

  all(...params: any[]) {
    const stmt = this.db.prepare(this.sql)
    if (params.length > 0) stmt.bind(params)
    const results: any[] = []
    while (stmt.step()) {
      results.push(stmt.getAsObject())
    }
    stmt.free()
    return results
  }
}

class Database {
  private db: any

  constructor(_filename: string) {
    this.db = new SQL.Database()
  }

  exec(sql: string) {
    this.db.exec(sql)
  }

  prepare(sql: string) {
    return new Statement(this.db, sql)
  }
}

export { Database }
export default Database
