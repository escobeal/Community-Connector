/******************************

OAuth2 functions to authenticate 3rd party service, Shape.
Mostly unchanged functions from Google's tutorials

*******************************/


function getOAuthService() {
  // Create a new service with the given name. The name will be used when
  // persisting the authorized token, so ensure it is unique within the
  // scope of the property store.
  
  // key-value pairs of current user
  var props = PropertiesService.getScriptProperties();
  
  return OAuth2.createService('shapeClientAuth')

      // Set the endpoint URLs
      .setAuthorizationBaseUrl(baseURL)
      .setTokenUrl(token)

      // Set the client ID and secret
      // Currently stored as a script property
      .setClientId(props.getProperty('clientID'))
      .setClientSecret(props.getProperty('clientSecret'))

      // Set the name of the callback function in the script referenced
      // above that should be invoked to complete the OAuth flow.
      // Unchanged
      .setCallbackFunction('authCallback')

      // Set the property store where authorized tokens should be persisted.
      // Unchanged
      .setPropertyStore(PropertiesService.getUserProperties())

      // Set the scopes to request (space-separated for Google services).
      // Unkown what to put hear for now. just read permissions?
      //.setScope('https://script.google.com/authCallback')
}

// Unchanged from tutorial
function showSidebar() {
  var authService = getOAuthService();
  if (!authService.hasAccess()) {
    var authorizationUrl = authService.getAuthorizationUrl();
    var template = HtmlService.createTemplate(
        '<a href="<?= authorizationUrl ?>" target="_blank">Authorize</a>. ' +
        'Reopen the sidebar when the authorization is complete.');
    template.authorizationUrl = authorizationUrl;
    var page = template.evaluate();
    DocumentApp.getUi().showSidebar(page);
  } else {
    // TODO
  }
}

// Unchanged from tutorial
function authCallback(request) {
  logCallBack(request.parameter.auth_token, request.parameter.code, request);
  var authService = getOAuthService();
  var authorized = authService.handleCallback(request);

  if (authorized) {
    return HtmlService.createHtmlOutput('Success! You can close this tab.');
  } else {
    return HtmlService.createHtmlOutput('Denied. You can close this tab');
  }
}

// Unchanged form tutorial
function isAuthValid() {
  var authService = getOAuthService();
  if (authService == null) {
    ("Auth service Not Valid.");
    //console.log("End isAuthValid");
    return false;
  }
  //console.log("Auth service Valid.");
  //return false;
  return authService.hasAccess();
}

// Set 3rd party service url for authorization
// TODO ?
function get3PAuthorizationUrls() {
  var authService = getOAuthService();
  if (authService == null) {
    return '';
  }
  return authService.getAuthorizationUrl();
}

//resets auth form 3rd partys and reset script properties
function resetAuth() {
  //console.log("Start reset Auth");
  CacheService.getUserCache().remove('token');
 
  var service = getOAuthService();
  service.reset();
  //console.log("End Reset Auth");
}

/*
  Description: Log the request given from the callback function of Authorization
  Set the token and client code
*/
function logCallBack(token, request){
  //console.log("Start logCallBack");
  
  var cache = CacheService.getUserCache();
  //6 hours
  var value = cache.put('token', token, 21600);
  
  //console.log("End logCallBack");
}