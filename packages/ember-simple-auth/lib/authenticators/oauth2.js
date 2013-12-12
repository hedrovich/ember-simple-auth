'use strict';

Ember.SimpleAuth.Authenticators.OAuth2 = Ember.Object.extend(Ember.Evented, {
  restore: function(properties) {
    var _this = this;
    return new Ember.RSVP.Promise(function(resolve, reject) {
      if (!Ember.isEmpty(properties.authToken)) {
        _this.handleAuthTokenRefresh(properties.authTokenExpiry, properties.refreshToken);
        resolve(properties);
      } else {
        reject();
      }
    });
  },

  authenticate: function(credentials) {
    var _this = this;
    return new Ember.RSVP.Promise(function(resolve, reject) {
      var data = _this.buildRequestData('password', ['username=' + credentials.identification, 'password=' + credentials.password]);
      Ember.$.ajax({
        url:         Ember.SimpleAuth.Authenticators.OAuth2.serverTokenEndpoint,
        type:        'POST',
        data:        data,
        contentType: 'application/x-www-form-urlencoded'
      }).then(function(response) {
        Ember.run(function() {
          _this.handleAuthTokenRefresh(response.expires_in, response.refresh_token);
          resolve({ authToken: response.access_token, authTokenExpiry: response.expires_in, refreshToken: response.refresh_token });
        });
      }, function(xhr, status, error) {
        Ember.run(function() {
          reject(xhr.responseText);
        });
      });
    });
  },

  unauthenticate: function() {
    Ember.run.cancel(Ember.SimpleAuth.Authenticators.OAuth2._refreshTokenTimeout);
    delete Ember.SimpleAuth.Authenticators.OAuth2._refreshTokenTimeout;
    return Ember.RSVP.resolve();
  },

  buildRequestData: function(grantType, data) {
    var requestData = ['grant_type=' + grantType].concat(data);
    if (!Ember.isEmpty(this.get('clientId'))) {
      requestData.push('client_id=' + this.get('clientId'));
      if (!Ember.isEmpty(this.get('clientSecret'))) {
        requestData.push('client_secret=' + this.get('clientSecret'));
      }
    }
    return requestData.join('&');
  },

  /**
    @method handleAuthTokenRefresh
    @private
  */
  handleAuthTokenRefresh: function(authTokenExpiry, refreshToken) {
    var _this = this;
    if (Ember.SimpleAuth.Authenticators.OAuth2.refreshAuthTokens) {
      Ember.run.cancel(Ember.SimpleAuth.Authenticators.OAuth2._refreshTokenTimeout);
      delete Ember.SimpleAuth.Authenticators.OAuth2._refreshTokenTimeout;
      var waitTime = (authTokenExpiry || 0) * 1000 - 5000;
      if (!Ember.isEmpty(refreshToken) && waitTime > 0) {
        Ember.SimpleAuth.Authenticators.OAuth2._refreshTokenTimeout = Ember.run.later(this, function() {
          var data  = this.buildRequestData('refresh_token', ['refresh_token=' + refreshToken]);
          Ember.$.ajax({
            url:         Ember.SimpleAuth.Authenticators.OAuth2.serverTokenEndpoint,
            type:        'POST',
            data:        data,
            contentType: 'application/x-www-form-urlencoded'
          }).then(function(response) {
            Ember.run(function() {
              authTokenExpiry = authTokenExpiry || response.expires_in;
              refreshToken = refreshToken || response.refresh_token;
              _this.handleAuthTokenRefresh(response.expires_in || authTokenExpiry, response.refresh_token || refreshToken);
              _this.trigger('updated_session_data', { authToken: response.access_token, authTokenExpiry: authTokenExpiry, refreshToken: refreshToken });
            });
          });
        }, waitTime);
      }
    }
  }
});

Ember.SimpleAuth.Authenticators.OAuth2.serverTokenEndpoint = '/token';
Ember.SimpleAuth.Authenticators.OAuth2.refreshAuthTokens   = true;
