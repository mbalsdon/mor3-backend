// TODO: how to register new OAuth apps short guide (in readme)

require('dotenv').config()

module.exports = class OsuWrapper {
  static API_URL = 'https://osu.ppy.sh/api/v2'
  static TOKEN_URL = 'https://osu.ppy.sh/oauth/token'
  token

  constructor (token) {
    if (typeof token === 'undefined') {
      throw new Error('Cannot be called directly')
    }
    this.token = token
  }

  static build () {
    const headers = {
      Accept: 'application/json',
      'Content-Type': 'application/json'
    }
    const data = {
      client_id: process.env.OSU_API_CLIENT_ID,
      client_secret: process.env.OSU_API_CLIENT_SECRET,
      grant_type: 'client_credentials',
      scope: 'public'
    }

    return fetch(OsuWrapper.TOKEN_URL, {
      method: 'POST',
      headers,
      body: JSON.stringify(data)
    })
      .then((response) => response.json())
      .then((data) => {
        return new OsuWrapper(data.access_token)
      })
  }

  fetchUsername (userId) {
    console.info(`OsuWrapper::fetchUsername( ${userId} )`)
    if (isNaN(parseInt(userId)) || parseInt(userId) < 1) {
      throw new Error('User ID must be a positive number')
    }
    const url = `${OsuWrapper.API_URL}/users/${userId}/osu`
    const params = {
      key: 'id'
    }
    const headers = {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      Authorization: `Bearer ${this.token}`
    }
    return fetch(url, {
      method: 'GET',
      headers,
      params
    })
      .then((response) => {
        if (response.status === 404) {
          throw new Error(`User ID ${userId} not found`)
        }
        return response.json()
      })
      .then((data) => {
        return data.username
      })
  }
}