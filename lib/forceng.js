/**
 * ForceNG - REST toolkit for Salesforce.com
 * Works with browser apps or Salesforce Mobile SDK
 * Version: 0.2
 */
angular.module('forceng', [])

    .factory('force', function ($rootScope, $q, $window, $http) {

        var loginURL = 'https://login.salesforce.com',

        // The Connected App client Id
            appId,

        // The force.com API version to use. Default can be overriden in login()
            apiVersion = 'v30.0',

        // Keep track of OAuth data (access_token, instance_url, and refresh_token)
            oauth,

        // Only required when using REST APIs in an app hosted on your own server to avoid cross domain policy issues
            proxyURL,

        // By default we store fbtoken in memory. This can be overridden in init()
            tokenStore = {},

        // if page URL is http://localhost:3000/myapp/index.html, context is /myapp
            context = window.location.pathname.substring(0, window.location.pathname.lastIndexOf("/")),

        // if page URL is http://localhost:3000/myapp/index.html, baseURL is http://localhost:3000/myapp
            baseURL = location.protocol + '//' + location.hostname + (location.port ? ':' + location.port : '') + context,

        // if page URL is http://localhost:3000/myapp/index.html, oauthRedirectURL is http://localhost:3000/myapp/oauthcallback.html
            oauthRedirectURL = baseURL + '/oauthcallback.html',

        // Because the OAuth login spans multiple processes, we need to keep the success/error handlers as variables
        // inside the module instead of keeping them local within the login function.
            deferredLogin,

        // Indicates if the app is running inside Cordova
            runningInCordova;

        document.addEventListener("deviceready", function () {
            runningInCordova = true;
        }, false);


        /**
         * Initialize ForceNG
         * @param params
         *  appId (optiona)
         *  loginURL (optional)
         *  apiVersion (optional)
         *  proxyURL (optional)
         *  tokenStore (optional)
         *  accessToken (optional)
         *  instanceURL (optional)
         *  refreshToken (optional)
         */
        function init(params) {
            if (params.appId) {
                appId = params.appId;
            }
            if (params.accessToken) {
                oauth = {access_token: params.accessToken, instance_url: params.instanceURL, refresh_token: params.refreshToken};
            }
            loginURL = params.loginURL || loginURL;
            apiVersion = params.apiVersion || apiVersion;
            tokenStore = params.tokenStore || tokenStore;
            oauthRedirectURL = params.oauthRedirectURL || oauthRedirectURL;
            proxyURL = params.proxyURL || proxyURL;

            // Load previously saved token
            if (tokenStore['forceOAuth']) {
                oauth = JSON.parse(tokenStore['forceOAuth']);
            }
        }

        /**
         * Login to Salesforce using OAuth. If running in a Browser, the OAuth workflow happens in a a popup window.
         */
        function login() {

            if (!appId) {
                throw 'appId parameter not set in init()';
            }

            deferredLogin = $q.defer();

            window.open(loginURL + '/services/oauth2/authorize?client_id=' + appId + '&redirect_uri=' + oauthRedirectURL +
                '&response_type=token', '_blank', 'location=no');

            return deferredLogin.promise;

        }

        /**
         * Called internally either by oauthcallback.html (when the app is running the browser)
         * @param url - The oauthRedictURL called by Salesforce at the end of the OAuth workflow. Includes the access_token in the querystring
         */
        function oauthCallback(url) {

            // Parse the OAuth data received from Facebook
            var queryString,
                obj;

            if (url.indexOf("access_token=") > 0) {
                queryString = url.substr(url.indexOf('#') + 1);
                obj = parseQueryString(queryString);
                oauth = obj;
                tokenStore['forceOAuth'] = JSON.stringify(oauth);
                if (deferredLogin) deferredLogin.resolve();
            } else if (url.indexOf("error=") > 0) {
                queryString = decodeURIComponent(url.substring(url.indexOf('?') + 1));
                obj = parseQueryString(queryString);
                if (deferredLogin) deferredLogin.reject(obj);
            } else {
                if (deferredLogin) deferredLogin.reject({status: 'access_denied'});
            }
        }

        /**
         * Check the login status
         * @returns {boolean}
         */
        function isLoggedIn() {
            return (oauth && oauth.access_token) ? true : false;
        }

        /**
         * Lets you make any Salesforce REST API request.
         * @param obj - Request configuration object. Can include:
         *  method:  HTTP method: GET, POST, etc. Optional - Default is 'GET'
         *  path:    path in to the Salesforce endpoint - Required
         *  params:  queryString parameters as a map - Optional
         *  data:  JSON object to send in the request body - Optional
         */
        function request(obj) {

            if (!oauth || (!oauth.access_token && !oauth.refresh_token)) {
                if (obj.error) {
                    obj.error('No access_token');
                }
                return;
            }

            var method = obj.method || 'GET',
                headers = {},
                url = proxyURL ? proxyURL : oauth.instance_url,
                deferred = $q.defer();

            // dev friendly API: Remove trailing '/' if any so url + path concat always works
            if (url.slice(-1) === '/') {
                url = url.slice(0, -1);
            }

            // dev friendly API: Add leading '/' if missing so url + path concat always works
            if (obj.path.charAt(0) !== '/') {
                obj.path = '/' + obj.path;
            }

            url = url + obj.path;

            headers["Authorization"] = "Bearer " + oauth.access_token;
            if (obj.contentType) {
                headers["Content-Type"] = obj.contentType;
            }
            if (proxyURL) {
                headers["Target-URL"] = oauth.instance_url;
            }

            $http({
                headers: headers,
                method: method,
                url: url,
                params: obj.params,
                data: obj.data })
                .success(function(data, status, headers, config) {
                    deferred.resolve(data);
                })
                .error(function(data, status, headers, config) {
                    if (status === 401 && oauth.refresh_token) {
                        refreshToken()
                            .success(function () {
                                // Try again with the new token
                                request(obj);
                            })
                            .error(function () {
                                console.error(data);
                                deferred.reject(data);
                            });
                    } else {
                        console.error(data);
                        deferred.reject(data);
                    }

                });

            return deferred.promise;
        }

        function refreshToken() {
            var oauthPlugin = cordova.require("com.salesforce.plugin.oauth"),
                deferred = $q.defer();
            if (oauthPlugin) {
                refreshTokenWithPlugin(deferred, oauthPlugin);
            } else {
                refreshTokenWithHTTPRequest(deferred);
            }
            return deferred.promise;
        }


        function refreshTokenWithPlugin(deferred, oauthPlugin) {
            oauthPlugin.authenticate(
                function(response) {
                    oauth.access_token = response.accessToken;
                    tokenStore['forceOAuth'] = JSON.stringify(oauth);
                    deferred.resolve();
                },
                function() {
                    console.log('Error refreshing oauth access token using the oauth plugin');
                    deferred.reject();
                });
        }

        function refreshTokenWithHTTPRequest(deferred) {
            var params = {
                    'grant_type': 'refresh_token',
                    'refresh_token': oauth.refresh_token,
                    'client_id': appId
                },

                headers = {},

                url = proxyURL ? proxyURL : loginURL;

            // dev friendly API: Remove trailing '/' if any so url + path concat always works
            if (url.slice(-1) === '/') {
                url = url.slice(0, -1);
            }

            url = url + '/services/oauth2/token?' + toQueryString(params);

            if (proxyURL) {
                headers["Target-URL"] = loginURL;
            }

            $http({
                headers: headers,
                method: 'POST',
                url: url,
                params: params})
                .success(function(data, status, headers, config) {
                    console.log('Token refreshed');
                    oauth.access_token = data.access_token;
                    tokenStore['forceOAuth'] = JSON.stringify(oauth);
                    deferred.resolve();
                })
                .error(function(data, status, headers, config) {
                    console.log('Error while trying to refresh token');
                    deferred.reject();
                });
        }

        /**
         * Discard the OAuth access_token. Use this function to test the refresh token workflow.
         */
        function discardToken() {
            delete oauth.access_token;
            tokenStore['forceOAuth'] = JSON.stringify(oauth);
        }

        /**
         * Execute SOQL query
         * @param soql
         * @returns {*}
         */
        function query(soql) {

            return request({
                path: '/services/data/' + apiVersion + '/query',
                params: {q: soql}
            });

        }

        /**
         * Retrieve a record based on its Id
         * @param objectName
         * @param id
         * @param fields
         * @returns {*}
         */
        function retrieve(objectName, id, fields) {

            return request({
                path: '/services/data/' + apiVersion + '/sobjects/' + objectName + '/' + id,
                params: fields ? {fields: fields} : undefined
            });

        }

        /**
         * Create a record
         * @param objectName
         * @param data
         * @returns {*}
         */
        function create(objectName, data) {

            return request({
                method: 'POST',
                contentType: 'application/json',
                path: '/services/data/' + apiVersion + '/sobjects/' + objectName + '/',
                data: data
            });

        }

        /**
         * Update a record
         * @param objectName
         * @param data
         * @returns {*}
         */
        function update(objectName, data) {

            var id = data.Id,
                fields = angular.copy(data);

            delete fields.attributes;
            delete fields.Id;

            return request({
                method: 'POST',
                contentType: 'application/json',
                path: '/services/data/' + apiVersion + '/sobjects/' + objectName + '/' + id,
                params: {'_HttpMethod': 'PATCH'},
                data: fields
            });

        }

        /**
         * Delete a record
         * @param objectName
         * @param id
         * @returns {*}
         */
        function del(objectName, id) {

            return request({
                method: 'DELETE',
                path: '/services/data/' + apiVersion + '/sobjects/' + objectName + '/' + id
            });

        }

        /**
         * Upsert a record
         * @param objectName
         * @param externalIdField
         * @param externalId
         * @param data
         * @returns {*}
         */
        function upsert(objectName, externalIdField, externalId, data) {

            return request({
                method: 'PATCH',
                contentType: 'application/json',
                path: '/services/data/' + apiVersion + '/sobjects/' + objectName + '/' + externalIdField + '/' + externalId,
                data: data
            });

        }

        function parseQueryString(queryString) {
            var qs = decodeURIComponent(queryString),
                obj = {},
                params = qs.split('&');
            params.forEach(function (param) {
                var splitter = param.split('=');
                obj[splitter[0]] = splitter[1];
            });
            return obj;
        }

        function toQueryString(obj) {
            var parts = [];
            for (var i in obj) {
                if (obj.hasOwnProperty(i)) {
                    parts.push(encodeURIComponent(i) + "=" + encodeURIComponent(obj[i]));
                }
            }
            return parts.join("&");
        }

        // The public API
        return {
            init: init,
            login: login,
            isLoggedIn: isLoggedIn,
            request: request,
            query: query,
            create: create,
            update: update,
            del: del,
            upsert: upsert,
            retrieve: retrieve,
            discardToken: discardToken,
            oauthCallback: oauthCallback
        };

    });

// Global function called back by the OAuth login dialog
function oauthCallback(url) {
    var injector = angular.element(document.body).injector();
    injector.invoke(function (force) {
        force.oauthCallback(url);
    });
}