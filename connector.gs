/******************************

Required functions expected by datastudio.

*******************************/


/*
  Description: Ask for any data that is relevant to get getting tailored data to the user
  request: A JavaScript object containing the config request parameters.
  As of now this takes nothing and supplies no relevant info.
  Ex. Company code to generate company's budgets, compaigns, etc.
*/
function getConfig(request) {
  console.log("Start getConfig");
  
  var config = {
    configParams: [
      {
        type: "INFO",
        name: "connect",
        text: "After authenticating with Shape, your authorization token will be used to proceed",
      },
    ],
    dateRangeRequired: true
  };
  config.configParams.push(getClientConfig());
  
  console.log("End getConfig");
  return config;
};


/*
  Description: Define whether debugging features should be used or not
  Return: true for debugging, false for not
  
  NOTE: KEEP OFF FOR VERSION RELEASE
  
  TODO: Base true or false of isAdmin on some factor
    Possibly email?
*/
function isAdminUser(){  
  console.log("Start isAdminUser");

  console.log("End isAdminUser");
  return false;
}

/*
  Description: Returns the schema object
  request: A JavaScript object containing the config request parameters.
  Return: A JavaScript object representing the schema
*/
function getSchema(request) {
  console.log("Start getSchema");

  console.log("End getSchema");
  return {schema: createFixedSchema()};
}


/*
  Descripton: Retrieves data from API, formats to a fixed form, then pushes all relevant fields to a list 'data'
  Creates a sub-schema with whatever elements are requested by data studio
  request: A JavaScript object containing the config request parameters.
  Return: tabular data for the given request.
*/
function getData(request) {
  console.log("Start getData");
    
  var auth_token;
  var cache = CacheService.getUserCache();
  var cacheToken = cache.get('token');
  if(cacheToken != null){
    auth_token = cacheToken;
  }
  else{
    resetAuth();
    throw new Error("DS_USER:Authorization Token has expired. Re-authenticate for a new token.");
  }  
  
  var client_code = request.configParams.selected_code_client;
  var fschema = [];
  var data = [];
  var newSchema = [];
  var url, fixedData, name, curSchemaItem, len, headerLen, path, index, found;
  
  //flag to hold whether a path was found or not
  var possiblePath = 1;
  
  fschema = createFixedSchema();
  url = getURL(request, client_code, auth_token);
  
  
  try{
    fixedData = getAPIData(url);
  }
  catch(e){
    console.log(e);
    console.log("Error setting fixed data");
    throw new Error(e);
  }

  //Sort fields to know how fixedData is sorted
  var headers = getFieldHeaders(request);
  headerLen = headers.length;  

  //Create a new schema based off whatever fields are being requested from data studio/user
  try{
    request.fields.forEach(function(field){
      for(var i = 0; i < fschema.length; i++){
        curSchemaItem = fschema[i];
        if(curSchemaItem.name == field.name){
          newSchema.push(curSchemaItem);
          break;
        }
      }
    });
  } catch(e){ console.log(e); }
  
  
  console.log("Start populate values");
  try{
    //go through each row of data
    len = fixedData.length
    for(var i = 0; i < len; i++){
      var values = [];
      //check which fields are requested
      newSchema.forEach(function(field){
        name = field.name;
        found = 0;
        //find where the field is located in the fixedData by using the sorted header array
        for(var j = 0; j < headerLen; j++){
          //set flag to showthat attribute hasn't been found yet         
          //if field is in headers then get the corresponding value from the query results and place in values
          if(name == headers[j]){
            //Handle null/no data
            if (fixedData[i][j] == null && field.dataType == 'NUMBER'){
              values.push(0);
              found = 1
            }
            else if(fixedData[i][j] == null || fixedData[i][j] == 'null' ){
              values.push('null');
              found = 1
            }
            else{
              values.push(fixedData[i][j]);
              found = 1;
            }
          }
        }
        //Handle if field wasn't found
        if (found == 0){
          values.push("N/A")
        }
        //add on the dates at the end to all fields 
        if(name == 'start_date'){
          values.push(formatDate(request.dateRange.startDate));
        }
        else if(name == 'end_date'){
          values.push(formatDate(request.dateRange.endDate));
        }
      });     
      data.push({        
        values: values
      });
    }
  }
  catch(e){
    console.log(e);
  }
  
  
  console.log("End getData");
  return {
    schema: newSchema,
    rows: data
  };
}

/*
  Description: Defines Auth2.0 is to be used at config
  Return: JS object containing Authorization type
*/
function getAuthType() {
  console.log("Start getAuthType");
  
  var response = {
    "type": "OAUTH2"
  };
  
  console.log("End getAuthType");
  return response;
}
