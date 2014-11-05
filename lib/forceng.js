/**
 * ForceNG - REST toolkit for Salesforce.com
 * Author: Christophe Coenraets @ccoenraets
 * Works with browser apps or Salesforce Mobile SDK
 * Version: 0.4
 */
angular.module('forceng', [])

    .factory('force', function ($rootScope, $q, $window, $http) {

        var loginURL = 'https://login.salesforce.com',

        // The Connected App client Id
            appId = '3MVG9fMtCkV6eLheIEZplMqWfnGlf3Y.BcWdOf1qytXo9zxgbsrUbS.ExHTgUPJeb3jZeT8NYhc.hMyznKU92',

        // The force.com API version to use. Default can be overriden in login()
            apiVersion = 'v32.0',

        // Keep track of OAuth data (access_token, instance_url, and refresh_token)
            oauth,

        // Only required when using REST APIs in an app hosted on your own server to avoid cross domain policy issues
            proxyURL = "http://localhost:8200",

        // By default we store fbtoken in memory. This can be overridden in init()
            tokenStore = {},

        // if page URL is http://localhost:3000/myapp/index.html, context is /myapp
            context = window.location.pathname.substring(0, window.location.pathname.lastIndexOf("/")),

        // if page URL is http://localhost:3000/myapp/index.html, baseURL is http://localhost:3000/myapp
            baseURL = location.protocol + '//' + location.hostname + (location.port ? ':' + location.port : '') + context,

        // if page URL is http://localhost:3000/myapp/index.html, oauthCallbackURL is http://localhost:3000/myapp/oauthcallback.html
            oauthCallbackURL = baseURL + '/oauthcallback.html',

        // Because the OAuth login spans multiple processes, we need to keep the success/error handlers as variables
        // inside the module instead of keeping them local within the login function.
            deferredLogin,

        // Indicates if the app is running inside Cordova
            oauthPlugin;

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
            var parts = [],
                i;
            for (i in obj) {
                if (obj.hasOwnProperty(i)) {
                    parts.push(encodeURIComponent(i) + "=" + encodeURIComponent(obj[i]));
                }
            }
            return parts.join("&");
        }

        function refreshTokenWithPlugin(deferred) {
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

                url = oauthPlugin ? loginURL : proxyURL;

            // dev friendly API: Remove trailing '/' if any so url + path concat always works
            if (url.slice(-1) === '/') {
                url = url.slice(0, -1);
            }

            url = url + '/services/oauth2/token?' + toQueryString(params);

            if (!oauthPlugin) {
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

        function refreshToken() {
            var deferred = $q.defer();
            if (oauthPlugin) {
                refreshTokenWithPlugin(deferred);
            } else {
                refreshTokenWithHTTPRequest(deferred);
            }
            return deferred.promise;
        }

        /**
         * Initialize ForceNG
         * @param params
         *  appId (optional)
         *  loginURL (optional)
         *  proxyURL (optional)
         *  oauthCallbackURL (optional)
         *  apiVersion (optional)
         *  accessToken (optional)
         *  instanceURL (optional)
         *  refreshToken (optional)
         */
        function init(params) {
            // Load previously saved token
            if (tokenStore.forceOAuth) {
                oauth = JSON.parse(tokenStore.forceOAuth);
            }

            if (params) {
                appId = params.appId || appId;
                apiVersion = params.apiVersion || apiVersion;
                tokenStore = params.tokenStore || tokenStore;
                loginURL = params.loginURL || loginURL;
                oauthCallbackURL = params.oauthCallbackURL || oauthCallbackURL;
                proxyURL = params.proxyURL || proxyURL;

                if (params.accessToken) {
                    if (!oauth) oauth = {};
                    oauth.access_token = params.accessToken;
                }

                if (params.instanceURL) {
                    if (!oauth) oauth = {};
                    oauth.instance_url = params.instanceURL;
                }

                if (params.refreshToken) {
                    if (!oauth) oauth = {};
                    oauth.refresh_token = params.refreshToken;
                }
            }
        }

        /**
         * Discard the OAuth access_token. Use this function to test the refresh token workflow.
         */
        function discardToken() {
            delete oauth.access_token;
            tokenStore.forceOAuth = JSON.stringify(oauth);
        }

        /**
         * Called internally either by oauthcallback.html (when the app is running the browser)
         * @param url - The oauthCallbackURL called by Salesforce at the end of the OAuth workflow. Includes the access_token in the querystring
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
         * Login to Salesforce using OAuth. If running in a Browser, the OAuth workflow happens in a a popup window.
         */
        function login() {
            deferredLogin = $q.defer();
            if (window.cordova) {
                loginWithPlugin();
            } else {
                loginWithBrowser();
            }
            return deferredLogin.promise;
        }

        function loginWithPlugin() {
            document.addEventListener("deviceready", function () {
                oauthPlugin = cordova.require("com.salesforce.plugin.oauth");
                if (!oauthPlugin) {
                    console.error('Salesforce Mobile SDK OAuth plugin not available');
                    if (deferredLogin) deferredLogin.reject({status: 'Salesforce Mobile SDK OAuth plugin not available'});
                    return;
                }
                oauthPlugin.getAuthCredentials(
                    function (creds) {
                        console.log(JSON.stringify(creds));
                        // Initialize ForceJS
                        init({accessToken: creds.accessToken, instanceURL: creds.instanceUrl, refreshToken: creds.refreshToken});
                        if (deferredLogin) deferredLogin.resolve();
                    },
                    function (error) {
                        console.log(error);
                        if (deferredLogin) deferredLogin.reject(error);
                    }
                );
            }, false);
        }

        function loginWithBrowser() {
            console.log('loginURL: ' + loginURL);
            console.log('oauthCallbackURL: ' + oauthCallbackURL);

            var loginWindowURL = loginURL + '/services/oauth2/authorize?client_id=' + appId + '&redirect_uri=' +
                oauthCallbackURL + '&response_type=token';
            window.open(loginWindowURL, '_blank', 'location=no');
        }

        /**
         * Gets the user's ID (if logged in)
         * @returns {string} | undefined
         */
        function getUserId() {
            return (typeof(oauth) !== 'undefined') ? oauth.id.split('/').pop() : undefined;
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
                deferred.reject(data);
                return;
            }

            var method = obj.method || 'GET',
                headers = {},
                url = oauthPlugin ? oauth.instance_url : proxyURL;
                deferred = $q.defer('No access token. Login and try again.');

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
            if (!oauthPlugin) {
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

        // The public API
        return {
            init: init,
            login: login,
            getUserId: getUserId,
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