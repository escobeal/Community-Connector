/*************************

Various non-required functions to further modularize connector file.
Functions used in multiple files/functions

*************************/


/*
  Descrption: Add a sudo-dynamic drop down list to the config page that shows all clients of a given user.
  Retrieve and cache authToken and save for 6 hours
  Retrieve and locally store client code of client selected
  Return: A JavaScript object representing the connector configuration that should be displayed to the user.
*/
function getClientConfig(){
  
  var clientConfig = {
    "type": "SELECT_SINGLE",
    "name": "selected_code_client",
    "displayName": "Select client to report on",
    "helpText": "The client selected will be used to report on",
    "options": [  ]
  };
  
  var auth_token;
  var cache = CacheService.getUserCache();
  var cacheToken = cache.get('token');
  if(cacheToken != null){
    auth_token = cacheToken;
  }
  else{
    resetAuth();
    throw new Error("DS_USER:Please re-authenticate. Authorization token expired.");
  }
  
  //get current list of all clients and codes for given auth token
  var getCodeUri = clientListURL
  
  //Format data to be fixed
  var url = encodeURI(getCodeUri); 
  var response = UrlFetchApp.fetch(url);
  var object = JSON.parse(response.getContentText());
  
  //Add a drop down list item for each client
  try{
    var clients = object.data.companies.clients;
    for(var i=0; i<clients.length; i++){
      clientConfig.options.push({"label": clients[i].name_client, "value":clients[i].code_client+""});
    }
  }
  catch(e){
    resetAuth();
    throw new Error(e);
  }
  return clientConfig;
}

/*
  Description: Standardize dates from YYYY-MM-DD to YYYYMMDD
*/
function formatDate(date){
  
  return date.replace(/-/g, '');
}

/*
  Description: Return array of objects in order of query
    var fieldMap = [{
      objectName - name
      fields - array of attributes
    }];
*/
function getFieldMap(request){
 
  var curObjectName, fieldName, query, curName, result;
  var found = 0;
  
  //start fieldMap with clients
  var fieldMap = [{
    objectName: 'clients',
    fields: []
  }];
  
  //Get all unique objectNamees of each requested field. Add as 'keys'
  request.fields.forEach(function(f){
    curName = f.name;
    //special case for objects that start with '_'
    if(checkFor_Object(curName)){
      curObjectName = curName.substr(0, findXInstanceOfY(curName, '_', 3));
    }
    //if not _ then just take the first portion
    else{
      curObjectName = curName.substr(0, curName.indexOf('_'));
    }
    
    //check if key exists yet, if not then add to map
    //iterate through entire array so as to not add multiple object names when something like
    //campaigns_cost, campaigns_name
    //occurs
    for(var objectNames in fieldMap){
      if(curObjectName == fieldMap[objectNames].objectName){
        found = 1;
      }
    }
    
    if(found == 0){
      fieldMap.push({
        objectName: curObjectName,
        fields: []
      });
    }
    found = 0;
  });
  
  //Check object of current field and add all relevant fields to that objects list
  //Ends with fieldMap containing all wanted fields from all objects
  request.fields.forEach(function(f){
    result = getObjectName(f.name)
    curObjectName = result.objectName
    fieldName = result.fieldName
    
    //add the field names to the object name it's associated with
    for(var objectNames in fieldMap){
      if(fieldMap[objectNames].objectName == curObjectName){
        fieldMap[objectNames].fields.push(fieldName);
      }
    }
  });
  
  return fieldMap;
}


/*
  Description: Finds x occurences of a given character(y) within a string
  return int of index
  TODO: DOCUMENT
*/
function findXInstanceOfY(str, y, x){
  var count = 0;
  var len = str.length;
  for(var j = 0; j < len; j++){
    if(str[j] == y){
      count++;
      if(count >= x){
        return j;
      }
    }
  }
  return -1;
}

/*
  Description: Compare requested object names and path object names
  Keep tracked
  AND RENAME VARIABLES
*/
function compareArrays(requestedFields, curPath){

  var pathObjectNames = [];
  var requestObjectNames = [];
  var curName, requestObjectNamesLen, counter;
  var equal = 1;
  //return object that holds count of similar objects and whether the two arrays hold the same object names
  var verdict = {
    bool: true,
    count: 0
  };
  
  //
  //remove '..._fieldName' names to just get object names from request
  for(var i = 0; i < requestedFields.length; i++){
    curName = requestedFields[i];
    //special cases with multiple '_'
    if(checkFor_Object(curName)){  
      //find 3rd instance of _ to remove trailing attribute name
      if(findXInstanceOfY(curName, '_', 3) >= 0){
        requestObjectNames.push(curName.substring(0, findXInstanceOfY(curName, '_', 3)));
      }
    }
    else{
      requestObjectNames.push(curName.substring(0, curName.indexOf('_'))); 
    }
  }
  requestObjectNamesLen = requestObjectNames.length;
  
  //get object names from path for readability
  for(var names in curPath){
    pathObjectNames.push(curPath[names].name);
  }
  
  //check if arrays contain the same objects
  //if not set a flag to return they are not equal.
  //Hold count of similar objects so if a path isnt found
  //the path with the most objects in common can be created instead
  for(var i = 0; i < requestObjectNamesLen; i++){
    if(pathObjectNames.indexOf(requestObjectNames[i]) === -1){
      verdict.bool = false
    }
    else{
      verdict.count = verdict.count+1
    }
  }
  
  //check how many objects are in 
  return verdict
}


/*
  get shortest path that contains all requested fields/objects
  normalize names to match what requested names would be
  create headers array
*/
function getFieldHeaders(request){
  var map = getFieldMap(request);
  var path = getShortestPath(request)
  var headers = [];
  var tmp;
  
  //If a path was not found place both arrays together to get object order
  //Get tree objects since they are only names at the moment
  if('found' in path){
    path = fieldsToTree(path.found.concat(path.notFound))
  }

  //in order of objects called
  for(var objects in path){
    //go through every object/objectName name in query
    for(var objectName in map){
      if(path[objects].name == map[objectName].objectName){
        //append the objectName/object name to the field namae and place into headers
        for(var field in map[objectName].fields){
          tmp = map[objectName].objectName +'_'+map[objectName].fields[field]
          //if(tmp[0] == '_'){tmp = tmp.splice(1)}        
          headers.push(tmp)
        }
      }
      
    }
  }
  
  return headers
}

/*
  Descrption: Places requested fields in order 
  with relation to how the call was pathed
*/
function sortRequestedFields(request){
  console.log("sortRequestedFields entered");

  var requestedFields = [];
  var sortedFields = [];
  var fieldMapOrder = [];
  var curObject, fieldsArray, curField;
  var path = getFieldMap(request);
  
  
  //Place fieldMap object_children combinations in one array
  for(var objects in path){
    curObject = path[objects];
    fieldsArray = curObject.fields;
    for(var children in fieldsArray){
      fieldMapOrder.push(curObject.objectName+'_'+fieldsArray[children]);
    }
  }
  
  //place only requested fields names in one array
  request.fields.forEach(function(field){
    requestedFields.push(field.name);
  });
  
  
  //push the fields in order to the sorted list
  for(var fields in fieldMapOrder){
    curField = fieldMapOrder[fields];
    if(requestedFields.indexOf(curField) >= 0){
      sortedFields.push(curField)
    }
  }
  console.log("sortRequestedFields exit");
  return sortedFields;
}

/*
  Description: Get tree object for given list of attributes.
  Params - fields: List of fields to return
  return list of tree objects 
  TODO: DOCUMENTATION
*/
function fieldsToTree(fields){
  var tree = createTree()
  var list = [];
  
  //for each field given, find it in the tree list
  for(var i = 0; i < fields.length; i++){
    curObject = (getObjectName(fields[i])).objectName
    for(var name in tree){
      if(curObject == tree[name].name){
        //found, so push whole object
        list.push(tree[name])
        break
      }
    }
  }
  
  //catch if nothing was populated
  if(list.length == 0){
    throw new Error("fieldsToTree completed without populating a list")
  }
  
  return list;
}


/*
  Description: Querys the Shape API to get the most current schema being used.
  Contains objects and all their attributes.
  Return: tree with all parent/children combinations
  Ex. {{childTypes=[String], name=clients, description=[null], attributeChildren=[name_client], listChildren=[accounts, budgets, bio], parents=[]}, ...} 
*/
function createTree(){
  console.log("Start createTree");
  
  var tree = [];
  var childList = [];
  var curObject, curTreeNode, curAttribute, curChild, curType, curKind, curName;
  var uri, response, done;

  //call to get schema
  url = secretSchemaCall
  uri = encodeURI(url);  
  try{
    response = UrlFetchApp.fetch(uri);
  }
  catch(e){
    console.log(e);
    throw new Error("Oh no! " + e);
    
  }
  done = JSON.parse(response.getContentText());
  
  //frequently used variable
  var topObjects = done.data.__schema.types;
  
  
  for(var types in topObjects){  
    curType = topObjects[types];
    curName = curType.name;
    
    //skip unwanted objects
    if(notUsedFields(curName)){
      continue;
    }
    
    //filter out non wanted types and add to tree
    //Exclude Float, String, Int, and anything with __
    if(curName[0] == '_'){
      if(curName[1] != '_'){
        tree.push({
          name: curName,
          parents: [],
          attributeChildren: [],
          listChildren: [],
          childTypes: [],
          description: []
        });
      }
    }
    else{
      if(curName[0] != curName[0].toUpperCase()){
        tree.push({
          name: curName,
          parents: [],
          attributeChildren: [],
          listChildren: [],
          childTypes: [],
          description: []
        });
      }
    }
  }
  
  
  //for each queriable field find all its possible children
  for(var names in topObjects){
    curObject = topObjects[names]
    for(var fields in tree){
      curTreeNode = tree[fields];
      if(curTreeNode.name == curObject.name){
        for(var attributes in curObject.fields){
          curAttribute = curObject.fields[attributes]
          curKind = curAttribute.type.kind
          //Object with possible children
          if(curKind== 'LIST' || curKind == 'OBJECT'){
            curTreeNode.listChildren.push(curAttribute.name);
          }
          //Its a child
          else{
            if(curAttribute.name.indexOf('code') >= 0){
              continue;
            }
            /*
              Attribute children have three arrays that store all information about it.
              attributeChildren - name of field
              childTypes - type
              description - string describing field
              Ideally, they all have the same element number to easily identify which name/type/description is associted with wich
            */
            curTreeNode.attributeChildren.push(curAttribute.name);
            curTreeNode.childTypes.push(curAttribute.type.name);
            curTreeNode.description.push(curAttribute.description);            }
        }
      }
    }
  }
  
  //Check which objects are parents of which
  //by checking if the current name is a 'child' of the current field being looked at
  tree.forEach(function(outerNode){
    tree.forEach(function(innerNode){
      childList = innerNode.listChildren;
      for(var children in childList){
        curChild = childList[children];
        if(outerNode.name == curChild){
          outerNode.parents.push(innerNode.name);
        }
      }
    });
  });
  
  console.log("end create tree");
  return tree;
}


/*
  Gets objects name and fields name by splitting the given field
  Split is determined by whether or not the field has a leading '_'
  TODO: DOCUMENT
*/
function getObjectName(str){
  var objectName, fieldName;
  
  if(checkFor_Object(str)){
    objectName = str.substr(0, findXInstanceOfY(str, '_', 3));
    fieldName = str.slice(findXInstanceOfY(str, '_', 3)+1);
  }
  else{
    objectName = str.substr(0, str.indexOf('_'));
    fieldName = str.slice(str.indexOf('_')+1);
  }
  
  return {
    objectName: objectName,
    fieldName: fieldName
  };
}

/*
  Description: Checks if string is _daily, _network, or _devices
  return 1 for true
  return 0 for false
  TODO: Change implementation to account for certain objcets/fields that require some of these.
  only specific object names
*/
function checkFor_Object(str){
  if(str.indexOf("type_network")!=-1){ return false; }
  if(str.indexOf('_daily') >= 0 || str.indexOf('_network') >= 0 || str.indexOf('_device') >= 0){
    return true;
  }
  return false;
}