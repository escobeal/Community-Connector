/******************************

All query related functions. Create API call, url, then parse and flatten the response
to datastudio expectations.

*******************************/


/*
  Description: Make call to API and receive data.
  url: API call url
  Return: Flattened dataset
*/
function getAPIData(url){  
  console.log("Start JSON Parse");
  
  var uri, response, done;
    
  uri = encodeURI(url); 
  try{
    response = UrlFetchApp.fetch(uri);
  }
  catch(e){
    resetAuth();
    throw new Error("Oh no! " + e);
    
  }
  done = JSON.parse(response.getContentText());
      
  //Poll with large datasets
  if(done.status == 'pending'){
    var pollingUrl = getPollingUrl(url, done);
    Utilities.sleep(1000);
    return getAPIData(pollingUrl)
  }
  
  var status = done.status;
  var message = done.message
  
  //Set up to handle multiple status's
  //May not care about them though...
  switch(status){
    case 'failure':
      console.log(done);
      throw new Error("DS_USER:Status - Failure: " + message);
      break;
  }
  
  
  /****************************
  ERROR HANDLE SHITTY DATA BETTER
  *****************************/
  if(typeof(done.data.clients) !== 'object'){
    throw new Error('DS_USER: Query to Shape API contains damaged data');
  }
  
  
  console.log("End JSON Parse");
  return stackIt(done.data.clients); 
}


/*
  Description: Flattens requested fields from given API call using a stack
  Finds the deepest possible object
  Retains current path to object and all data in each of those fields
  data: raw json object strting at the 'clients' object
  return: flat data set containing rows with each requested field in it.
    ex. {{BudgetAmountdata1, CampaignCostdata1}, {BudgetAmountdata2, CampaignCostdata2}, …}
*/
function stackIt(data){

  console.time(stackIt);
  console.log("Start Stack");
  var totalData = [];
  
  //create stack with highest object
  var stack = [{
    v: data,
    parent_fields: []
  }];
  
  var stackLen = stack.length;
  var pushing = 0;
  var totalFields = 0;
  var data_fields, array_field, cl, v, current_fields, temp, arr_len, row, cpf;
  
  
  while(stackLen > 0){
    //store current node 
    cl = stack.pop();
    if (cl===undefined){
      break;
    }
    v = cl.v;
    
    //fill new array with all parents
    data_fields = cl.parent_fields.slice(0);
    array_field = null;
    current_fields = [];
    
    //Does another object exist?
    //also track all current fields
    for(var field in v){
      temp = v[field]
      current_fields.push(temp);
      if (typeof(temp) === 'object' && temp != null){
        array_field = field;
        break;
      }
    }

    //Yes, so store all current fields as parents
    if(array_field != null){
      for(var field in v){
        temp = v[field];
        if (typeof(temp) !== 'object'){
          data_fields.push(temp);
        }
      }
    } 

    //Push new node to stack to delve deeper
    //each one with parent nodes
    if (array_field != null){
      arr_len = v[array_field].length;
      for(var i=0; i<arr_len; i++){
        //Skip broken fields
        if('errors' in v[array_field][i]){
          continue;
        }
        stack.push({
          v: v[array_field][i],
          parent_fields: data_fields
        });
      }      
    }    
    //No object exists below
    else{     
      row = [];
      
      //get total number of fields that should exist
      if (pushing == 0){
        pushing = 1;
        totalFields = data_fields.length + current_fields.length;
      }      
      
      //push parents fields
      if(data_fields.length > 0){
        for(var parentFields in data_fields){
          row.push(data_fields[parentFields]);
        }
      }
      
      //push current fields
      for(var curFields in current_fields){
        row.push(current_fields[curFields]);
      }
      
      //Push all rows at lowest level
      //exit if done
      if(row.length != totalFields){
        console.log("End Stack"); 
        return totalData;
      }
      else{
        totalData.push(row)
      }
    }
  }
  
  console.log("End Stack with empty stack"); 
  console.log("Number Rows: " + totalData.length);
  return totalData;
}


/*
  Description: Creates URL from the request from the user to minimize call times
  request: A JavaScript object containing the config request parameters.
  client_code: chosen client 
  auth_token: cached token for current shape user 
  Return: url for API call
*/
function getURL(request, client_code, auth_token){
  console.log("Start getURL");
  
  var fieldMap = getFieldMap(request);
  var startDate = formatDate(request.dateRange.startDate);
  var endDate = formatDate(request.dateRange.endDate); 
  var path = getShortestPath(request);
  var numObjects = 0; 

  //first portion of url always the same
  var query = 'https://api.shape.io/v1.6/clients/' + client_code + '/?application=datastudio&fields=';
  
  //each object has its attributes added in order
  for(var names in path){ 
    numObjects++;
    query += addAttributes(fieldMap, path[names].name);    
  }
  
  //remove last comma, add closures
  //sub 1 from numObjects to compensate for clients not having a '}'
  query = query.replace(/,([^,]*)$/,'$1');
  for(var i = 0; i < numObjects-1; i++){
    query += '}';
  }
  
  //append ending auth_token and date params
  query += '&auth_token=' + auth_token + '&date_start=' + startDate + '&date_end=' + endDate;


  console.log("End getURL");
  //console.log(query);
  return query;
}


/*
  Description: Creates string that contains all Attributes of a given object name from requested fields
  Returns a string similar to 'objectName{attribute1,attribute2,etc...,'
*/
function addAttributes(fieldMap, pos){
  var str = '';
  var curObjectName, fields;
  
  if(pos != 'clients'){
    //add only _daily, _network, or _device for the query
    if(checkFor_Object(pos)){
      str = pos.substring(0, findXInstanceOfY(pos, '_', 2)) + '{';
    }
    else{
      str = pos + '{';
    }
  }
  
  for(var objectNames in fieldMap){
    curObjectName = fieldMap[objectNames];
    if (curObjectName.objectName == pos){
      fields = curObjectName.fields;
      for (var Attributes in fields){
        str += fields[Attributes] + ',';
      }
    }
  }
  
  return str;
}


/*
  Description: Find shortest path that contains all requested objects
  Checks all paths at each level to check if requested objects have been found
  Error if no possible path.
  request: A JavaScript object containing the config request parameters.
  Return: Array with object path to deepest object. 
*/
function getShortestPath(request){

  console.log("Start getShortestPath");
  
  var curNode, rootIndex, foundPath;
  var shortestPath = [];
  var curPath = [];
  var mostSimilarPath = []
  var pathFound = false;
  var queue = [];
  var requestedFields = [];
  var tree = createTree();
    
  //find root location in tree
  for (var i in tree){
    if(tree[i].name == 'clients'){
      rootIndex = i;
      break;
    }
  }  
  
  //root
  var queue_element = {
    "node" : tree[i],
    "path" : []
  };
  queue.push(queue_element);
      
  //Get each requested field into one array
  //readability
  request.fields.forEach(function (field){
      requestedFields.push(field.name);
  });  
    
  //BFS then check if current path(s) contain all needed fields
  while(queue.length>0){
    
    //get a path off the queue of paths
    //get the node from the end of the current path
    var curElement = queue.shift();
    var curNode = curElement.node;
    curPath = curElement.path;
    curPath.push(curNode);
    
    //compare path to request and store return object
    var verdict = compareArrays(requestedFields, curPath)   
    foundPath = verdict.bool
    
    //Add second key to all paths with a count of how many objects they have in common
    curPath.count = verdict.count
    
    //hold the path with the most objects in common for use if no path is found
    //If there is no mostsimilar yet then hold current path
    if (curPath.count > mostSimilarPath.count || !('count' in mostSimilarPath)){
      mostSimilarPath = curPath
    }

    //check if all requested objects exist in the current path
    if(foundPath == true){
      //delete count key to correctly index elsewhere key
      delete curPath.count
      console.log("Path found");
      console.log("end getShortestPath");
      return curPath; 
    }
    
    //if no
    //Does the node have object children?
    var children = curNode.listChildren;
    if(children.length !== 'undefined' && children.length > 0){
      
      for(var child in children){
        var curChild = children[child];
        
        //special case for a few attribtues
        if(checkFor_Object(curChild)){
          curChild += ('_' + curNode.name); 
        }
        
        //find child object in tree and place in queue as a new path
        for (var i in tree){
          if(tree[i].name == curChild){
            var new_path = curPath.slice(0);
            var newElement = {
              node : tree[i],
              path : new_path
            };
            queue.push(newElement);
          }
        }
      }
    }
  }  

  console.log("Path not found");
  console.log("End getShortestPath");

  //delete count key to correctly index elsewhere
  delete mostSimilarPath.count
  return mostSimilarPath
}


/***************************
Functions supplied by Shape
****************************
/*
  Description: Assemble the polling url from the url_polling returned
*/
function getPollingUrl(url, data){
  var params = getJsonFromQuery(url);
  var url = data.errors.url_polling + '?auth_token=' + params.auth_token;
  if(params.id_company){
   url = url + "&id_company=" + params.id_company;
  }
  return url;
}


/*
* This function parses a shape api query converting params to a json object
*/
function getJsonFromQuery(query) {
  var query;
  var pos = query.indexOf("?");
  if(pos==-1) return [];
  query = query.substr(pos+1);
  var result = {};
  query.split("&").forEach(function(part) {
    if(!part) return;
    part = part.split("+").join(" "); // replace every + with space, regexp-free version
    var eq = part.indexOf("=");
    var key = eq>-1 ? part.substr(0,eq) : part;
    var val = eq>-1 ? decodeURIComponent(part.substr(eq+1)) : "";
    var from = key.indexOf("[");
    if(from==-1) result[decodeURIComponent(key)] = val;
    else {
      var to = key.indexOf("]",from);
      var index = decodeURIComponent(key.substring(from+1,to));
      key = decodeURIComponent(key.substring(0,from));
      if(!result[key]) result[key] = [];
      if(!index) result[key].push(val);
      else result[key][index] = val;
    }
  });
  return result;
}