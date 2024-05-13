
extract_elements = "\
arguments[0].setAttribute('id','newMasapiBody');\
arguments[0].setAttribute('data-masapi-id', '0');\
let elementsToClassify = [];\
createElementObjects(arguments[0]);\
function createElementObjects(rootElem){\
  for(var child of rootElem.childNodes){\
    if (child.nodeType == 1){ \
      elementsToClassify.push(getAllFeatures(child))\
    }\
    createElementObjects(child);\
  }\
}\
function getAllFeatures(element){\
  var elemObject = new Object();\
  elemObject.tagname = element.tagName;\
  elemObject.text = getText(element);\
  elemObject['data-masapi-id'] = getPathToRoot(document.body, element);\
  elemObject['data-masapi-user-selection'] = 'neutral';\
  elemObject.childrenCount = element.childElementCount;\
  elemObject.allAttributes = getAttributes(element);\
  elemObject.style = getStyle(element);\
  return(elemObject);\
}\
function getText(element){\
  var nodes = element.childNodes;\
  var text = [];\
  for(var i = 0; i < nodes.length; i++) {\
      if(nodes[i].nodeType == 3) { \
          text.push(nodes[i].nodeValue);\
      }\
  }\
  return text;\
}\
function getStyle(element) {\
  var style = window.getComputedStyle(element);\
  var copiedStyle = {};\
  for (var i = 0; i < style.length; i++) {\
    var key = style[i];\
    copiedStyle[key] = style.getPropertyValue(key);\
  }\
  return copiedStyle;\
}\
function getAttributes(element){\
  function getAllAttributes(el) {\
    var obj = {};\
    var attrNames = el.getAttributeNames();\
    for (var i = 0; i < attrNames.length; i++) {\
      var name = attrNames[i];\
      obj[name] = el.getAttribute(name);\
    }\
    return obj;\
  }\
  return getAllAttributes(element);\
}\
function getPathToRoot(root, node){\
  let path = [];\
  while (node !== root){\
    const parent = node.parentElement;\
    const children = Array.from(parent.children);\
    const nodeIndex = children.indexOf(node);\
    path.push(nodeIndex);\
    node = parent;\
  }\
  reversedPath = path.reverse();\
  reversedPath.unshift(0);\
  reversedPath = reversedPath.join('-');\
  return reversedPath;\
}\
return elementsToClassify"

match_suggested="\
elements = arguments[0].getElementsByTagName('*');\
var matched_elements = [];\
for (var i = 0; i < elements.length; i++){\
  var elem_id = getPathToRoot(document.body, elements[i]);\
  for (var j = 0; j < arguments[1].length; j++){\
    if (arguments[1][j] == elem_id){\
      matched_elements.push(elements[i])\
    }\
  }\
}\
function getPathToRoot(root, node){\
  let path = [];\
  while (node !== root){\
    const parent = node.parentElement;\
    const children = Array.from(parent.children);\
    const nodeIndex = children.indexOf(node);\
    path.push(nodeIndex);\
    node = parent;\
  }\
  reversedPath = path.reverse();\
  reversedPath.unshift(0);\
  reversedPath = reversedPath.join('-');\
  return reversedPath;\
}\
return matched_elements"

masapi_id="\
let masapiID = getPathToRoot(document.body, arguments[0]);\
function getPathToRoot(root, node){\
  let path = [];\
  while (node !== root){\
    const parent = node.parentElement;\
    const children = Array.from(parent.children);\
    const nodeIndex = children.indexOf(node);\
    path.push(nodeIndex);\
    node = parent;\
  }\
  reversedPath = path.reverse();\
  reversedPath.unshift(0);\
  reversedPath = reversedPath.join('-');\
  return reversedPath;\
}\
return masapiID;"

get_text="\
var text = getText(arguments[0]);\
function getText(element){\
  var nodes = element.childNodes;\
  var text = [];\
  for(var i = 0; i < nodes.length; i++) {\
      if(nodes[i].nodeType == 3) {\
          text.push(nodes[i].nodeValue);\
      }\
  }\
  return text;\
}\
return text"