const { google } = require('googleapis')

require('dotenv').config()

module.exports = class SheetsWrapper {
  static SPREADSHEET_ID = '1hduRLLIFjVwLGjXyt7ph3301xfXS6qjSnYCm18YP4iA'
  static AUTH = new google.auth.GoogleAuth({
    keyFile: process.env.GOOGLE_API_KEYFILE,
    scopes: 'https://www.googleapis.com/auth/spreadsheets'
  })

  sheetsClient

  constructor (sheetsClient) {
    if (typeof sheetsClient === 'undefined') {
      throw new Error('Cannot be called directly')
    }
    this.sheetsClient = sheetsClient
  }

  static build () {
    return SheetsWrapper.AUTH.getClient()
      .then((authClient) => {
        const sheetsClient = google.sheets({ version: 'v4', auth: authClient })
        return new SheetsWrapper(sheetsClient)
      })
  }

  fetchMetadata () {
    console.info('SheetsWrapper::fetchMetadata()')
    return this.sheetsClient.spreadsheets.get({
      auth: SheetsWrapper.AUTH,
      spreadsheetId: SheetsWrapper.SPREADSHEET_ID
    })
      .then((response) => {
        return response.data
      })
  }

  fetchUserIds () {
    console.info('SheetsWrapper::fetchUserIds()')
    return this.sheetsClient.spreadsheets.values.get({
      auth: SheetsWrapper.AUTH,
      spreadsheetId: SheetsWrapper.SPREADSHEET_ID,
      range: 'Users!A2:A500',
      majorDimension: 'COLUMNS'
    })
      .then((response) => {
        return response.data.values[0]
      })
  }

  putUser (userId, username) {
    console.info(`SheetsWrapper::putUser( ${userId}, ${username} )`)
    if (isNaN(parseInt(userId)) || parseInt(userId) < 1) {
      throw new Error('User ID must be a positive number')
    } else if (typeof username !== 'string') {
      throw new Error('Username must be a string')
    }

    return this.sheetsClient.spreadsheets.values.append({
      auth: SheetsWrapper.AUTH,
      spreadsheetId: SheetsWrapper.SPREADSHEET_ID,
      range: 'Users',
      valueInputOption: 'USER_ENTERED',
      insertDataOption: 'INSERT_ROWS',
      resource: {
        values: [[userId, username]]
      }
    })
      .then((response) => {
        return response
      })
  }
}