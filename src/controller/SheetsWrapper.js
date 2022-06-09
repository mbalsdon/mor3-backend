const { google } = require('googleapis')
const Mods = require('./Mods')

require('dotenv').config()

module.exports = class SheetsWrapper {
  static #SPREADSHEET_ID = '1hduRLLIFjVwLGjXyt7ph3301xfXS6qjSnYCm18YP4iA'
  static #USERS_SHEET_ID = 253307812
  static #AUTH = new google.auth.GoogleAuth({
    keyFile: process.env.GOOGLE_API_KEYFILE,
    scopes: 'https://www.googleapis.com/auth/spreadsheets'
  })

  #sheetsClient

  constructor (sheetsClient) {
    if (typeof sheetsClient === 'undefined') {
      throw new Error('Cannot be called directly')
    }
    this.#sheetsClient = sheetsClient
  }

  static async build () {
    const authClient = SheetsWrapper.#AUTH.getClient()
    const sheetsClient = google.sheets({ version: 'v4', auth: authClient })
    return new SheetsWrapper(sheetsClient)
  }

  async fetchMetadata () {
    console.info('SheetsWrapper::fetchMetadata()')
    const response = await this.#sheetsClient.spreadsheets.get({
      auth: SheetsWrapper.#AUTH,
      spreadsheetId: SheetsWrapper.#SPREADSHEET_ID
    })
    return response.data
  }

  async fetchUserIds () {
    console.info('SheetsWrapper::fetchUserIds()')
    const response = await this.#sheetsClient.spreadsheets.values.get({
      auth: SheetsWrapper.#AUTH,
      spreadsheetId: SheetsWrapper.#SPREADSHEET_ID,
      range: 'Users!A:A',
      majorDimension: 'COLUMNS'
    })
    return response.data.values[0].slice(1)
  }

  async insertUser (userId, username) {
    console.info(`SheetsWrapper::insertUser( ${userId}, ${username} )`)
    if (isNaN(parseInt(userId)) || parseInt(userId) < 1) {
      throw new Error('User ID must be a positive number')
    } else if (typeof username !== 'string') {
      throw new Error('Username must be a string')
    }

    const response = await this.#sheetsClient.spreadsheets.values.append({
      auth: SheetsWrapper.#AUTH,
      spreadsheetId: SheetsWrapper.#SPREADSHEET_ID,
      range: 'Users',
      valueInputOption: 'USER_ENTERED',
      insertDataOption: 'INSERT_ROWS',
      resource: {
        values: [[userId, username]]
      }
    })
    return response.data
  }

  async removeUser (userId) {
    console.info(`SheetsWrapper::removeUser( ${userId} )`)
    if (isNaN(parseInt(userId)) || parseInt(userId) < 1) {
      throw new Error('User ID must be a positive number')
    }

    const userIds = await this.fetchUserIds()
    const idIndex = userIds.indexOf(userId)
    if (idIndex === -1) {
      throw new Error(`User with ID ${userId} could not be found`)
    }
    const batchUpdateRequest = {
      requests: [
        {
          deleteDimension: {
            range: {
              sheetId: SheetsWrapper.#USERS_SHEET_ID,
              dimension: 'ROWS',
              startIndex: idIndex + 1,
              endIndex: idIndex + 2
            }
          }
        }
      ]
    }
    const response = await this.#sheetsClient.spreadsheets.batchUpdate({
      auth: SheetsWrapper.#AUTH,
      spreadsheetId: SheetsWrapper.#SPREADSHEET_ID,
      resource: batchUpdateRequest
    })
    return response.data
  }

  async fetchModScores (mods) {
    console.info(`SheetsWrapper::fetchModScores( ${mods} )`)
    if (Mods.toSheetId(mods) === -1) {
      throw new Error(`${mods} is not a valid mod combination`)
    }

    const response = await this.#sheetsClient.spreadsheets.values.get({
      auth: SheetsWrapper.#AUTH,
      spreadsheetId: SheetsWrapper.#SPREADSHEET_ID,
      range: `${mods}!A:G`,
      majorDimension: 'ROWS'
    })
    return response.data.values.slice(1)
  }

  async fetchScore (mods, rowNum) {
    console.info(`SheetsWrapper::fetchScore( ${mods}, ${rowNum} )`)
    if (Mods.toSheetId(mods) === -1) {
      throw new Error(`${mods} is not a valid mod combination`)
    } else if (isNaN(parseInt(rowNum)) || parseInt(rowNum) < 0) {
      throw new Error('Row number cannot be negative')
    }
    const response = await this.#sheetsClient.spreadsheets.values.get({
      auth: SheetsWrapper.#AUTH,
      spreadsheetId: SheetsWrapper.#SPREADSHEET_ID,
      range: `${mods}!A${rowNum + 2}:G${rowNum + 2}`,
      majorDimension: 'ROWS',
      valueRenderOption: 'FORMULA'
    })
    return response.data.values[0]
  }

  // Doesn't check if scores are already in the sheet
  async insertScores (mods, scores) {
    console.info(`SheetsWrapper::insertScores( ${mods}, array of ${scores.length} scores )`)
    if (Mods.toSheetId(mods) === -1) throw new Error(`${mods} is not a valid mod combination`)
    for (const score of scores) {
      if (!this.#isScore(score)) throw new Error(`Invalid score: [${score}]`)
    }

    const response = await this.#sheetsClient.spreadsheets.values.append({
      auth: SheetsWrapper.#AUTH,
      spreadsheetId: SheetsWrapper.#SPREADSHEET_ID,
      range: `${mods}`,
      valueInputOption: 'USER_ENTERED',
      insertDataOption: 'INSERT_ROWS',
      resource: {
        values: scores
      }
    })
    return response.data
  }

  async removeScore (mods, id) {
    console.info(`SheetsWrapper::removeScore( ${mods}, ${id} )`)
    if (Mods.toSheetId(mods) === -1) {
      throw new Error(`${mods} is not a valid mod combination`)
    } else if (isNaN(parseInt(id)) || parseInt(id) < 1) {
      throw new Error('Score ID must be a positive number')
    }

    const scores = await this.fetchModScores(mods)
    const scoreIndex = scores.map((s) => s[0]).indexOf(id)
    if (scoreIndex === -1) {
      throw new Error(`Score with ID ${id} could not be found`)
    }
    const batchUpdateRequest = {
      requests: [
        {
          deleteDimension: {
            range: {
              sheetId: Mods.toSheetId(mods),
              dimension: 'ROWS',
              startIndex: scoreIndex + 1,
              endIndex: scoreIndex + 2
            }
          }
        }
      ]
    }
    const response = await this.#sheetsClient.spreadsheets.batchUpdate({
      auth: SheetsWrapper.#AUTH,
      spreadsheetId: SheetsWrapper.#SPREADSHEET_ID,
      resource: batchUpdateRequest
    })
    return response.data
  }

  // Returns true if score is typed properly, false otherwise
  // Doesn't check things like if ID exists, if hyperlink is proper, 0<acc<100, etc.
  #isScore (score) {
    if (!Array.isArray(score)) return false
    if (score.length !== 7) return false
    if (typeof score[0] !== 'number') return false
    if (typeof score[1] !== 'string' && !(score[1] instanceof String)) return false
    if (typeof score[2] !== 'string' && !(score[2] instanceof String)) return false
    if (Mods.toSheetId(score[3]) === -1) return false
    if (typeof score[4] !== 'number') return false
    if (typeof score[5] !== 'number') return false
    if (typeof score[6] !== 'string' && !(score[6] instanceof String)) return false

    return true
  }
}
