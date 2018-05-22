/******************************

Retrieve and create most recent schema used by Shape API.

TODO: addCalculatedFields

*******************************/


/*
  Description: Create Data schema for Data studio that has
  up to date fields from Shape API.
  Not currently adding Semantic types as data studio can auto recognize them
  Return: Javascript object representing API schema
  
  TODO:
    Standardize grouping names ex. _daily -> (Daily Campaigns)
    remove object names from variables start ex. campaigns_name -> Name
    For calculated fields, instead create a formula for field. Maybe hard coded pull from Lite version
    
*/
function createFixedSchema(){
  console.log("Start createFixedSchema");

  var fixedSchema = [];
  var attrChildList = [];
  var curAttribute, newName, newLabel, curType, newType, newGroup, newDescription;
  //Get updated schema
  var tree = createTree();
    
  //Iterate through each objects's children
  tree.forEach(function(object){
    attrChildList = object.attributeChildren;
    
    //skip unuseable objects
    if(!notUsedFields(object.name)){
    
      for(var i in attrChildList){
        //Normalize names and labels to fit naming conventions
        newName = object.name +'_'+attrChildList[i];
        newLabel = capitalize(newName.replace(/_/g, ' '));     
        newDescription = object.description[i];
        newGroup = '('+capitalize(object.name.replace(/_/g, ' '))+')';        

        //When theres no description
        if(newDescription == 'null'){
          newDescription = "No available description at this time.";
        }
        
        //special case ex. with leading udnerscore
        if(newLabel[0] == ' '){
          newLabel = newLabel.slice(1);
        }
        
        //set the type of the child
        curType = object.childTypes[i];
        
        //check child type to define a dataType
        if(curType == 'Float' || curType == 'Int'){
          newType = 'NUMBER';
        }        
        else{
          newType = 'STRING';
        }
        
        
        //Check for any additional semantic details that need to be added
        if(percentFields(newName)){
          fixedSchema.push({
            name: newName,
            label: newLabel,
            group: newGroup,
            dataType: newType,
            description: newDescription,
            semantics: {
              semanticType: 'PERCENT',
              semanticGroup: 'NUMERIC',
            }
          });
        }
        else if(currencyFields(newName)){
          fixedSchema.push({
            name: newName,
            label: newLabel,
            group: newGroup,
            dataType: newType,
            description: newDescription,
            semantics: {
              semanticType: 'CURRENCY_USD',
              semanticGroup: 'CURRENCY',
            }
          });       
        }
        else if(dateFields(newName)){
          fixedSchema.push({
            name: newName,
            label: newLabel,
            group: 'Date',
            dataType: 'NUMBER',
            description: newDescription,
            semantics: {
              semanticType: 'YEAR_MONTH_DAY',
              semanticGroup: 'DATE_AND_TIME',
              conceptType: 'DIMENSION'
            }
          });
        }
        else{
          fixedSchema.push({
            name: newName,
            label: newLabel,
            dataType: newType,
            group: newGroup,
            description: newDescription,
          });
        }
      }
    }
  });
  
  console.log("End createFixedSchema");
  
  // fixedSchema = addCalculatedFields(fixedSchema);
  
  return fixedSchema;
}


function addCalculatedFields(fixedSchema){ 
  /** TODO: Add calculated fields here **/
  /** TODO: We will need to prevent the actual instances of these fields from being added to the schema **/
  fixedSchema.push({
    name: "campaigns_ctr",
    label: "Campaigns CTR",
    group: 'Campaign',
    dataType: 'NUMBER',
    description: "Calculated Campaign CTR",
    formula: "sum(campaigns_clicks)/sum(campaigns_impressions)"
  });

  return fixedSchema;
}


/*
  Description: Checks str for unwated substrings
  return 1 for does contain
  return 0 if does not contain
*/
function notUsedFields(str){

  if(str == undefined){
    throw new Error("Undefined string given");
  }

  if(str.indexOf('datasource') < 0 && str.indexOf('bio') < 0 && str.indexOf('datasources') < 0 && str.indexOf('sets') < 0 && str.indexOf('account') < 0 && str.indexOf('query') < 0 && str.indexOf('_daily_api_stats') < 0 && str.indexOf('_hourly_api_stats') < 0 && str.indexOf('companies') < 0){
    return 0;
  }
  return 1;
}


/*
  Description: Capitalize all first letters in a string after ' '
*/
function capitalize(str)
{

  if (typeof(str) === null || str == 'null'){
    return 'null';
  }
  var array1 = str.split(' ');
  var newarray1 = [];
  var len = array1.length;
    
  for(var x = 0; x < len; x++){
    newarray1.push(array1[x].charAt(0).toUpperCase()+array1[x].slice(1));
  }
  return newarray1.join(' ');
}

/*
  Description: Checks if given string requires the 'currency' semantic
  Params: str - field name

*/
function currencyFields(str){
  
  //This format works over the if (.. || ..)
  //no clue why
  //Possible contained strings that suggest
  if (str.indexOf('cost') >= 0){return true}
  else if(str.indexOf('cpc') >= 0){return true}
  else if(str.indexOf('cpm') >= 0){return true}
  else if(str.indexOf('value') >= 0){ return true}
  else if(str.indexOf('cpv') >= 0){ return true}
  
  return false;
}


/*
  Description: Checks if given string requires the 'percent' semantic
  Params: str - field name

*/
function percentFields(str){

  //Possible contained strings that suggest
  if(str.indexOf('ctr') >=0 || str.indexOf('rate') >= 0){
    return true;
  }
  return false;
}

/*
  Description: Checks if given string requires the 'date' semantic
  Params: str - field name
*/
function dateFields(str){

  //Possible contained strings that suggest
  if(str.indexOf('date') >=0){
    return true
  }
  
  return false
}