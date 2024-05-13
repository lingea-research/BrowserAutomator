let mutationList;
let clonedBody;
let recObserver;
let clfObserver;
let observerOptions;
let selectedElements;
var oldSelections;
let positiveElements, negativeElements;
let highlighted, elementsToSend, currHighlighted;
let currentCondition;

document.onreadystatechange = function () {
  if (document.readyState === 'complete') {
    console.log(document.readyState);
    var recording;
    var oldSel;
    recObserver = new MutationObserver(recordingObserverFunc);
    clfObserver = new MutationObserver(clfObserverFunc);
    observerOptions = {childList: true, subtree: true, attributes: false};
    
    chrome.runtime.sendMessage({type: 'check_recording_selecting'}, function(response) {
      recording = response.recording;
      selecting = response.selecting;
      // TODO: selecting nemusi byt?
      console.log('recording val z backgroundu: ', recording);
      if (recording == true && (selecting == undefined || selecting == false)){
        // nacteni nove stranky behem nahravani 
        recObserver.observe(document.body, observerOptions);
        document.body.addEventListener('click', getClickedElement);
        document.body.addEventListener('keyup', getKey);
        document.body.addEventListener('keydown', getKey);
        //document.body.addEventListener('contextmenu', getFocusedElement);
      }
    });
    
    chrome.runtime.onMessage.addListener(function(message, sender, sendResponse){
      console.log('received message.type: ', message.type)
      if (message.type === 'recording_from_popup'){
        recording = message.recording;
        console.log('recording val z popupu: ', recording);
        if (recording == true){
          // zahajeni nahravani tlacitkem
          console.log('vyber zahajen')
          // TODO: SMAZAT
          // krome zoomu problem i se zvetsenim pc/ monitor/ ..
          var startingURL = window.location.href;
          var windowHeight = window.outerHeight + 5; // TODO: dokontrolovat hodnoty 5, 10 na jinych monitorech
          var windowWidth = window.outerWidth + 10; // TODO: dořešit view kdyz otevrena konzola, ... ?
          chrome.runtime.sendMessage({startingURL: startingURL, windowHeight: windowHeight,
                                      windowWidth: windowWidth, type: 'startingURL'}, function(response) {
            
            chrome.runtime.sendMessage({action: 'open_browser',
                                        headless: false, // TODO: zadavani uzivatelem
                                        startingURL: window.location.href,
                                        windowHeight: windowHeight,
                                        windowWidth: windowWidth,
                                        type: 'action_performed'
                                      }, function(response) {
            });
          });
          
          // add recording listeners
          recObserver.observe(document.body, observerOptions);
          document.body.addEventListener('click', getClickedElement);
          document.body.addEventListener('keyup', getKey);
          document.body.addEventListener('keydown', getKey);

          // TODO: listening to all events
          for(var key in document.body){
            if(key.search('onclick') === 0) {
              //console.log(key)
              document.body.addEventListener(key.slice(2), event =>{
                //console.log('event', event)
              })
            }
          }
        }
        else if (recording == false){
          document.body.removeEventListener('click', getClickedElement);
          document.body.removeEventListener('keyup', getKey);
          document.body.removeEventListener('keydown', getKey);
          recObserver.disconnect();
        }
        sendResponse('přijato do content-scriptu： '+JSON.stringify(recording)); 
      }
      else if (message.type === 'next_element') {
        removeBackground(currentCondition)

        // find element
        for (var i = 0; i < elements.length; i++){
          var elem_id = elements[i].getAttribute('data-masapi-id');
          if (message.current_condition == elem_id){
            currentCondition = elements[i];
            currentCondition.style.backgroundColor = "yellow";
            break;
          }
        }
        
        positiveElements = [];
        negativeElements = [];
 
        for (var i = 0; i < elements.length; i++){  // kvuli "opravnym" klikum pri podminenem vyberu
          elements[i].setAttribute('data-masapi-user-selection', 'neutral');
        }
      }  
      else if (message.type === 'selecting_elements'){
        var selecting = message.selecting;

        // remove basic recording listener
        document.body.removeEventListener('click', getClickedElement);
        document.body.removeEventListener('keyup', getKey);
        document.body.removeEventListener('keydown', getKey);
        //document.body.removeEventListener('contextmenu', getFocusedElement); 
        recObserver.disconnect();

        if (selecting == 'manually'){
          console.log('selecting elements manually')

          selectedElements = [];
          // stop events and add listener
          addCustomListener(root = document.body, listener = stopClicks)
          addCustomListener(root = document.body, listener = getSelectedElement)
        }
        else if (selecting == 'classifier'){
          console.log('training classifier')

          positiveElements = [];
          negativeElements = [];
          highlighted = [];
          elementsToSend = [];
          //currHighlighted = null;

          // in setTreeIDs: stop events and add listener
          var bodyHtml = document.body.outerHTML;   //obrazky se do outerHTML ulozi az po nacteni stranky 

          bodyAttrs = getAttributes(document.body);
          var clonedBodyAttrs = _.cloneDeep(bodyAttrs);

          originalBody = document.getElementsByTagName("body");  //vraci html collection 
          hideElement(originalBody[0]);

          var clonedBody = _.cloneDeep(bodyHtml);
          
          newbody = document.createElement("body");
          newbody.setAttribute("id","newMasapiBody");
    
          document.getElementsByTagName("html")[0].appendChild(newbody);
          newbody.innerHTML = clonedBody;
    
          for (var property in clonedBodyAttrs) {
            if (!clonedBodyAttrs.hasOwnProperty(property)) continue;
            newbody.setAttribute(property, clonedBodyAttrs[property])
          }
          console.log('stahovani featur vsech elementu')

          newbody.setAttribute("id","newMasapiBody");  
          elements = newbody.getElementsByTagName("*");
    
          rootElement = document.getElementById("newMasapiBody");
          rootElement.setAttribute("data-masapi-id", "0");
          // adding click listeners in setTreeIDs
          setTreeIDs(rootElement, getChosenElements = true);

          clfObserver.observe(newbody, observerOptions); //newbody pro sledovani zmen pouze ve zkopirovanem body

          console.log('stazeno, cekani na klik')
        }
        else if (selecting == 'classifier_param'){
          positiveElements = [];
          negativeElements = [];
          highlighted = [];
          elementsToSend = [];

          let rootElement = document.getElementById("newMasapiBody");
          rootElement.setAttribute("data-masapi-id", "0");
          // adding click listeners in setTreeIDs
          setTreeIDs(rootElement, getChosenElements = true);

          clfObserver.observe(newbody, observerOptions); //newbody pro sledovani zmen pouze ve zkopirovanem body

          console.log('stazeno, cekani na klik')
        }
      }
      else if (message.type === 'show_loaded_clf'){
        let selecting = message.selecting;
        let classifier = message.classifier;

        // remove basic recording listener
        document.body.removeEventListener('click', getClickedElement);
        document.body.removeEventListener('keyup', getKey);
        document.body.removeEventListener('keydown', getKey);
        recObserver.disconnect();

        // prozatim if, casem mozna i selection?
        if (selecting == 'classifier' || selecting == 'classifier_param'){
          console.log('loading classifier')

          positiveElements = [];
          negativeElements = [];
          highlighted = [];
          elementsToSend = [];

          var bodyHtml = document.body.outerHTML;   //obrazky se do outerHTML ulozi az po nacteni stranky 

          bodyAttrs = getAttributes(document.body);
          var clonedBodyAttrs = _.cloneDeep(bodyAttrs);

          originalBody = document.getElementsByTagName("body");  //vraci html collection 
          hideElement(originalBody[0]);

          var clonedBody = _.cloneDeep(bodyHtml);
          
          newbody = document.createElement("body");
          newbody.setAttribute("id","newMasapiBody");
    
          document.getElementsByTagName("html")[0].appendChild(newbody);
          newbody.innerHTML = clonedBody;
    
          for (var property in clonedBodyAttrs) {
            if (!clonedBodyAttrs.hasOwnProperty(property)) continue;
            newbody.setAttribute(property, clonedBodyAttrs[property])
          }
          console.log('stahovani featur vsech elementu')

          newbody.setAttribute("id","newMasapiBody");  
          elements = newbody.getElementsByTagName("*");
    
          rootElement = document.getElementById("newMasapiBody");
          rootElement.setAttribute("data-masapi-id", "0");
          // adding click listeners in setTreeIDs
          setTreeIDs(rootElement, getChosenElements = false);

          clfObserver.observe(newbody, observerOptions); //newbody pro sledovani zmen pouze ve zkopirovanem body
        
          chrome.runtime.sendMessage({elemCount: elementsToSend.length, type: 'elemCount'}, function(response) {
            //console.log('response z backgroundu: ', response);
          });
        
          console.log('pocet elementu: ', elementsToSend.length)
          console.log('vytvareni a odesilani elements')
        
          for(var i = 0; i < elements.length; i++){
            toSendID = elements[i].getAttribute("data-masapi-id")
        
            for (var j = 0; j < elementsToSend.length; j++){
              elem = elementsToSend[j];
              if (elementsToSend[j]['allAttributes']['data-masapi-id'] == toSendID){
                elem.allAttributes = getAttributes(elements[i])
                chrome.runtime.sendMessage({element: (elem),
                                            classifier: classifier,
                                            type: 'load_classifier_elems'});
              }
            }
          }
          console.log('odeslany elementy')
        }
      }
      else if (message.type === 'stop_training_classifier'){
        console.log('stop training classifier')

        // clear selected elements
        positiveElements = [];
        negativeElements = [];
        currentCondition = null;

        // remove background from selected
        for (el in highlighted){
          removeBackground(highlighted[el])
        }

        clfObserver.disconnect();
        document.getElementsByTagName("html")[0].removeChild(newbody);
        showElement(originalBody[0]);

        // add recording listeners
        recObserver.observe(document.body, observerOptions);
        document.body.addEventListener('click', getClickedElement);
        document.body.addEventListener('keyup', getKey);
        document.body.addEventListener('keydown', getKey);
        //document.body.addEventListener('contextmenu', getFocusedElement);

      }
      else if (message.type === 'highlight_loaded_clf'){
        let suggested = message.suggested;
        let highlighted = [];

        for (var i = 0; i < elements.length; i++){
          var elem_id = elements[i].getAttribute('data-masapi-id');
          if (suggested.includes(elem_id)){
            highlighted.push(elements[i])
          }
        }
        for (const elem of highlighted){
          elem.style.backgroundColor = "yellow";
        }
      }
      else if (message.type === 'highlight_condition'){
        let condition_id = message.condition;
        console.log('CONDITION:', condition_id)

        //removnu background z minule
        for (var i = 0; i < elements.length; i++){
          removeBackground(elements[i]);
        }

        // highlight condition
        for (var i = 0; i < elements.length; i++){
          var elem_id = elements[i].getAttribute('data-masapi-id');
          if (condition_id == elem_id){
            currentCondition = elements[i];
            currentCondition.style.backgroundColor = "yellow";
            break;
          }
        }

        positiveElements = [];
        negativeElements = [];
 
        for (var i = 0; i < elements.length; i++){  // kvuli "opravnym" klikum pri podminenem vyberu
          elements[i].setAttribute('data-masapi-user-selection', 'neutral');
        }
      }
      else if (message.type === 'stop_selection'){
        console.log(message.type)

        let todo = message.todo;

        if (todo == 'save'){
          saveSelection();
        }
        // else jenom 'delete'


        // remove highlighting
        for (el in selectedElements){
          removeBackground(selectedElements[el])
        }
        console.log('poslano na server');

        // clear selected elements
        selectedElements = [];
        positiveElements = [];
        negativeElements = [];
        currHighlighted = [];

        // remove listeners stopping event propagation
        removeCustomListener(root = document.body, listener = getSelectedElement);
        removeCustomListener(root = document.body, listener = stopClicks);

        // add recording listeners
        recObserver.observe(document.body, observerOptions);
        document.body.addEventListener('click', getClickedElement);
        document.body.addEventListener('keyup', getKey);
        document.body.addEventListener('keydown', getKey);
        //document.body.addEventListener('contextmenu', getFocusedElement);

        // send response to popup - just to inform that the action was sent to server
        sendResponse({response: ''})
      }
      else if (message.type === 'suggested_elements') { // navrhy pri trenovani klasifikatoru
        document.documentElement.style.cursor = 'default';
        console.log('prijato zpet')
  
        //removnu background z minule
        for (var i = 0; i < elements.length; i++){
            removeBackground(elements[i]);
        }
  
        if (currentCondition){
          currentCondition.style.backgroundColor = "yellow";
        }

        highlighted = [];
        allSuggested = message.allSuggested;
        console.log('current suggested:', allSuggested)

        //allSuggested = JSON.parse(allSuggested);
        currentSuggested = allSuggested; // TODO: potom pridat pro vice navazanych clfs

        console.log('suggested: ', currentSuggested);
        /*
        if (oldSel){
          changeSelectionsColor(oldSelections)
        }
        */
        for (var i = 0; i < elements.length; i++){
          var elem_id = elements[i].getAttribute('data-masapi-id');
          for (var j = 0; j < currentSuggested.length; j++){ 
            if (currentSuggested[j] == elem_id){
              highlighted.push(elements[i])
              background1(elements[i]);
            }
          }
        }
        /*
        if (currHighlighted){
          currHighlighted.style.backgroundColor = "yellow";
        }
        */

        console.log('oznaceno')
      }
    });
  }
}

function addCustomListener(root = root, listener = listener){
  root.addEventListener('click', listener); 
  for(var child of root.childNodes){  //children
    if (child.nodeType == 1){ 
      addCustomListener(root = child, listener = listener);
    }
  }
}

function removeCustomListener(root = root, listener = listener){
  root.removeEventListener('click', listener); 
  for(var child of root.childNodes){  //children
    if (child.nodeType == 1){ 
      removeCustomListener(root = child, listener = listener);
    }
  }
}

function stopClicks(evt) {
  evt.preventDefault();
  evt.stopPropagation();
}

function getElementToClassify(evt){
  console.log('kliknuto')
  console.log('porovnani highlighted')
  evt = evt || window.event;
  var clickedElement = evt.clickedElement || evt.srcElement;
  document.documentElement.style.cursor = 'wait';

  if (highlighted.includes(clickedElement)){
    negativeElements.push(clickedElement);
    removeBackground(clickedElement);
    clickedElement.setAttribute("data-masapi-user-selection", "false");
    for( var i = 0; i < positiveElements.length; i++){ 
      if ( positiveElements[i] === clickedElement) { 
          positiveElements.splice(i, 1); 
      }
    }
  }
  else if (!highlighted.includes(clickedElement)){
    positiveElements.push(clickedElement);
    background1(clickedElement);
    clickedElement.setAttribute("data-masapi-user-selection", "true");
    var overlaps = checkOverlapping(clickedElement,positiveElements);
    if (overlaps){
      var sortedOverlaps = sortByDepth(overlaps,findParents(overlaps));
      changeColor(sortedOverlaps);
    }
    for( var i = 0; i < negativeElements.length; i++){ 
      if ( negativeElements[i] === clickedElement) { 
        negativeElements.splice(i, 1); 
      }
    }
  }
  
  chrome.runtime.sendMessage({elemCount: elementsToSend.length, type: 'elemCount'}, function(response) {
    //console.log('response z backgroundu: ', response);
  });

  console.log('pocet elementu: ', elementsToSend.length)
  console.log('vytvareni a odesilani elements')


  for(var i = 0; i < elements.length; i++){
    toSendID = elements[i].getAttribute("data-masapi-id")

    for (var j = 0; j < elementsToSend.length; j++){
      elem = elementsToSend[j];
      if (elementsToSend[j]['allAttributes']['data-masapi-id'] == toSendID){
        elem.allAttributes = getAttributes(elements[i])
        chrome.runtime.sendMessage({element: (elem), type: 'send_elems_to_server'});
      }
    }
  }
  console.log('odeslany elementy')
}

function getKey(evt){
  evt = evt || window.event;
  let element = evt.target;
  let key = String(evt.code);
  let action_type = evt.type;
  /*
  console.log('element', element)
  console.log('key evt:', action_type)
  console.log('key:', key)
  */
  const do_not_record_keys = ['NumLock', 'CapsLock', 'ContextMenu']

  if (!do_not_record_keys.includes(key)){
    let elementObject = elementSelectors(evt)
    if (action_type == 'keydown'){
      chrome.runtime.sendMessage({element: elementObject,
                                  key: key,
                                  count: 1,
                                  action: action_type,
                                  type: 'action_performed'});
    }
    else if(action_type == 'keyup'){
      chrome.runtime.sendMessage({element: elementObject,
                                  key: key,
                                  action: action_type,
                                  type: 'action_performed'});
    }
  }
}

function watchTextInputChanges(evt){
  var element = evt.target;
  console.log(element.value);

  let elementObject = elementSelectors(evt)

  chrome.runtime.sendMessage({element: elementObject,
                              value: element.value,
                              action: 'insert_text',
                              type: 'action_performed'});
}

function changeSelectionsColor(arr){
  var degree = 115;
  for (var i = 0; i < arr.length; i++){
    var sel = arr[i]
    degree = degree + 30;
    if (degree > 265){
      degree = 130;
    }
    var col = '';
    col = col.concat('hsl(', degree, ',55%,80%)')
    for (var j = 0; j < sel.length; j++){
      sel[j].style.backgroundColor = col;
    }
  }
}

function recordingObserverFunc(mutations){
  for (let mutation of mutations) {
    //console.log('mutation', mutation)
    if (mutation.type === 'childList') {
      console.log('mutation', mutation)
      //mutationList.push(mutation);
    }
  }
  //console.log('mutationsList: ', mutationsList);
}

function getElementXPath(element){
  var paths = [];  // Use nodeName (instead of localName) so namespace prefix is included (if any).
  //let shadowRoot;

  for (; element && element.nodeType == Node.ELEMENT_NODE; element = element.parentNode){
    //shadowRoot = chrome.dom.openOrClosedShadowRoot(element) // pomoci .children se lze dostat dovnitr
    //console.log('shadowRoot', shadowRoot) // shadowRoot.nodeName == #document-fragment
    //console.log('shadowRoot.nodeName', shadowRoot.nodeName)
    //console.log('shadowRoot.children', shadowRoot.children)

    if (element && element.id){
      let id_path = '//*[@id="' + element.id + '"]'
      let rest_of_paths = paths.length ? "/" + paths.join("/") : null;
      if (rest_of_paths)
        return id_path.concat(rest_of_paths)
      else{
        return id_path
      }
    }
    else{
      var index = 0;
      var hasFollowingSiblings = false;
      for (var sibling = element.previousSibling; sibling; sibling = sibling.previousSibling){
        // Ignore document type declaration.
        if (sibling.nodeType == Node.DOCUMENT_TYPE_NODE)
          continue
  
        if (sibling.nodeName == element.nodeName)
          ++index
      }
  
      for (var sibling = element.nextSibling; sibling && !hasFollowingSiblings; sibling = sibling.nextSibling){
        if (sibling.nodeName == element.nodeName)
          hasFollowingSiblings = true
      }
  
      var tagName = (element.prefix ? element.prefix + ":" : "") + element.localName;
      var pathIndex = (index || hasFollowingSiblings ? "[" + (index + 1) + "]" : "");
      paths.splice(0, 0, tagName + pathIndex);
    }
  }
  return paths.length ? "/" + paths.join("/") : null;
}


function getAbsoluteXPath(element){
  var paths = [];
  for (; element && element.nodeType == Node.ELEMENT_NODE; element = element.parentNode){
    var index = 0;
    var hasFollowingSiblings = false;
    for (var sibling = element.previousSibling; sibling; sibling = sibling.previousSibling){
      // Ignore document type declaration.
      if (sibling.nodeType == Node.DOCUMENT_TYPE_NODE)
        continue

      if (sibling.nodeName == element.nodeName)
        ++index
    }

    for (var sibling = element.nextSibling; sibling && !hasFollowingSiblings; sibling = sibling.nextSibling){
      if (sibling.nodeName == element.nodeName)
        hasFollowingSiblings = true
    }

    var tagName = (element.prefix ? element.prefix + ":" : "") + element.localName;
    var pathIndex = (index || hasFollowingSiblings ? "[" + (index + 1) + "]" : "");
    paths.splice(0, 0, tagName + pathIndex);
  }
  return paths.length ? "/" + paths.join("/") : null;
}

function setTreeIDs(rootElem, getChosenElements){ // navic kontrola typu uzlu
  var siblingID = 0;
  var parentID;

  if (rootElem.nodeType == 1){
    parentID = rootElem.getAttribute('data-masapi-id');
  }
  else {
    var newParent = rootElem;
    while (newParent.nodeType !== 1){
      newParent = newParent.parentNode;
    }
    parentID = newParent.getAttribute('data-masapi-id');
  }
  if (getChosenElements == true){
    for(var child of rootElem.childNodes){  //children
      if (child.nodeType == 1){ 
        child.setAttribute('data-masapi-id', parentID + '-' + siblingID);
        siblingID++;
        child.setAttribute('data-masapi-user-selection', 'neutral');
        child.addEventListener('click', getElementToClassify);
        child.addEventListener('click', stopClicks); 
        elementsToSend.push(getAllFeatures(child))
      }
      setTreeIDs(child, getChosenElements);
    }
  }
  else {
    for(var child of rootElem.childNodes){  //children
      if (child.nodeType == 1){ 
        child.setAttribute('data-masapi-id', parentID + '-' + siblingID);
        siblingID++;
        child.setAttribute('data-masapi-user-selection', 'neutral');
        child.addEventListener('click', stopClicks); 
        elementsToSend.push(getAllFeatures(child))
      }
      setTreeIDs(child, getChosenElements);
    }
  }
}

function hideElement(element){
  element.style.display = "none";
}

function showElement(element){
  element.style.display = "block";  
}

function docReady(fn) {
  if (document.readyState === 'complete') { //  || document.readyState === "interactive" // see if DOM is already available
      setTimeout(fn, 1);   // call on next available tick
      alert('ready')
  } else {
      document.addEventListener('load', fn); //'DOMContentLoaded'
  }
}

function stopClicks(evt) {
  evt.preventDefault();
  evt.stopPropagation();
}

function getClickedElement(evt) {
  console.log('kliknuto');
  evt = evt || window.event;
  var clickedElement = evt.target;
  var isOpening = isOpeningNewTab(clickedElement)
  var URL = window.location.href;
  console.log('clickedElement: ', clickedElement)
  console.log('currentURL: ', URL)

  // track changes in text elements
  if (clickedElement.value !== undefined){
    clickedElement.addEventListener('input', watchTextInputChanges);
  }

  let elementObject = elementSelectors(evt)

  chrome.runtime.sendMessage({element: elementObject,
                              action: 'click',
                              is_opening_in_new_tab: isOpening,
                              type: 'action_performed'}, function(response) {
  });
  console.log('poslano na server');
}

function elementSelectors(evt){
  let element = evt.target;

  let elementObject = new Object();
  elementObject.xpath = getElementXPath(element)
  elementObject.abs_xpath = getAbsoluteXPath(element)
  return elementObject;
}

function getSelectedElement(evt) {
  console.log('selected');
  evt = evt || window.event;
  var selectedElement = evt.target;

  isSelected = checkIfAlreadySelected(selectedElement)
  if (isSelected == false){
    selectedElements.push(selectedElement)
    highlightBackground(selectedElement)
  }
  else{
    selectedElements = selectedElements.filter(e => e !== selectedElement)
    removeBackground(selectedElement)
  }
  console.log('selectedElements: ', selectedElements)
}

function checkIfAlreadySelected(element){
  if (selectedElements.includes(element)){
    return true;
  }
  else{
    return false;
  }
}

function saveSelection(){
  let xpath, absXpath, focusedElement;
  let selection = [];

  for (let element of selectedElements){
    focusedElement = new Object();
    xpath = getElementXPath(element)
    absXpath = getAbsoluteXPath(element)

    focusedElement.xpath = xpath
    focusedElement.abs_xpath = absXpath
    selection.push(focusedElement)
  }

  chrome.runtime.sendMessage({elements: selection,
                              action: 'selection',
                              type: 'action_performed'
                            }, function(response) {
    //console.log('response z backgroundu: ', response);
  });
}

function isOpeningNewTab(element){
  var isOpening = false
  var target = element.getAttribute('target')
  if (target == '_blank'){ // TODO: mohlo by byt i neco jineho? napr. ''
    isOpening = true
  }
  return isOpening
}

function getAttributes(element){
  function getAllAttributes(el) {
    var obj = {};
    var attrNames = el.getAttributeNames();
    for (var i = 0; i < attrNames.length; i++) {
      var name = attrNames[i];
      obj[name] = el.getAttribute(name);
    }
    return obj;
  }
  return getAllAttributes(element);
}

function clfObserverFunc(mutations){
  for (let mutation of mutations) {
    //console.log(mutation)
    if (mutation.type === 'childList') {
      for (var i = 0; i < mutation.addedNodes.length; i++){
        var addedElem = mutation.addedNodes[i];
        if (addedElem.nodeType == 1){
          console.log('added element', addedElem)
          addAfterMutation(addedElem);
        }
      }
      for (var i = 0; i < mutation.removedNodes.length; i++){
        var removedElem = mutation.removedNodes[i];
        if (removedElem.nodeType == 1){
          removedID = removedElem.getAttribute('data-masapi-id');
          console.log('removed element', removedElem)
          removeAfterMutation(removedID)
        }
      }
    }
  }
}

function addAfterMutation(addedElem){
  if (addedElem.parentNode){
    setTreeIDs(addedElem.parentNode, getChosenElements = true)
  }
  else{
    // preskocim sourozence od body? 
  }
}

function removeAfterMutation(removedID){
  for (var i = 0; i < elementsToSend.length; i++){
    if (elementsToSend[i]['allAttributes']['data-masapi-id'] == removedID){
      elementsToSend.splice(i,1)
    }
  }
}

function elementsOverlap(elem1, elem2) {
  const domRect1 = elem1.getBoundingClientRect();
  const domRect2 = elem2.getBoundingClientRect();

  return !(
    domRect1.top > domRect2.bottom ||
    domRect1.right < domRect2.left ||
    domRect1.bottom < domRect2.top ||
    domRect1.left > domRect2.right
  );
}

function sortByDepth(arr, parentArr){
  for(var i = 0; i < (parentArr.length); i++){ 
    for(var j = 0; j < (parentArr.length-i-1); j++){
      if(parentArr[j] > parentArr[j+1]){
        var temp = parentArr[j]
        parentArr[j] = parentArr[j+1]
        parentArr[j+1] = temp

        var temp2 = arr[j]
        arr[j] = arr[j+1]
        arr[j+1] = temp2
      }
    }
  }
  return arr;
}

function changeColor(arr){
  light = 80;
  for (var i = 0; i < arr.length; i++){
    light = light - 8;
    var col = '';
    col = col.concat('hsl(0,100%,', light, '%)')
    arr[i].style.backgroundColor = col;
  }
}

function checkOverlapping(elem, arr){
  var overlaps = [];  //elem?
  if (arr.length > 0){
    for(var i = 0; i < (arr.length-1); i++){ 
      if (elementsOverlap(elem,arr[i]) == true){
        overlaps.push(arr[i]);
      }
    }
  }
  if (overlaps.length > 0) {
    overlaps.push(elem);
  }
  return overlaps;
}

function findParents(arr){
  var comparedParents = [];
  for(var i = 0; i < (arr.length); i++){ 
    var elemParents = [];
    var a = arr[i];
    while (a){
      elemParents.unshift(a);
      a = a.parentNode;
    }
    elemParents = elemParents.length;
    comparedParents.push(elemParents);
  }
  return comparedParents;
}

// pro zmeny barev u prekryvajicich se elems
function findDeepestElem(arr,parentArr){
  var parentCount = 0;
  var deepestElems = [];
  for (var i = 0; i < (arr.length); i++){ 
    if (parentArr[i] > parentCount){
      parentCount = parentArr[i];
    }
  }
  for (var i = 0; i < (arr.length); i++){ 
    if (parentArr[i] == parentCount){
      deepestElems.push(arr[i]);
    }
  }
  return deepestElems[0];
}

function removeBackground(element){
  element.style.backgroundColor = null;
}

function highlightBackground(element){
  element.style.backgroundColor = "rgba(245, 238, 39, 0.54)"; 
}

// pro vice stupnu barev
function background1(element){
  element.style.backgroundColor = "rgba(255, 155, 155, 1)"; // rgba(215, 240, 156)
}

function background2(element){
  element.style.backgroundColor = "rgba(198, 221, 144)";
}

function background3(element){
  element.style.backgroundColor = "rgba(181, 206, 126)";
}

function background4(element){
  element.style.backgroundColor = "rgba(165, 189, 113)";
}

function background5(element){
  element.style.backgroundColor = "rgba(165, 189, 113)";
}

function getAllFeatures(element){
  // TODO: zkontrolovat parenty apod? i pro prehravani v javascript_functions.py
  var elemObject = new Object();
  elemObject.tagname = element.tagName;
  //elemObject.cssClass = element.classList;
  //elemObject.className = className(element);
  elemObject.text = getText(element);
  elemObject.childrenCount = element.childElementCount;
  elemObject.allAttributes = getAttributes(element);
  elemObject.style = getStyle(element);
  
  //elemObject.firstChildTag = firstChildTag(element);
  //elemObject.parents = getParents(element); // parents vraci prazdne {} {} {}, deti taky
  //elemObject.className = className(element);
  //elemObject.dataID = getDataID(element);   // neni potreba, je uz v atributech
  //elemObject.children = getChildren(element);
  //elemObject.parentNode = parentNode(element);
  //elemObject.parentElements = getParentElements(element);
  //elemObject.ID = getID(element);
  //console.log(elemObject);
  return(elemObject);
}

function getStyle(element) {
  var style = window.getComputedStyle(element);
  var copiedStyle = {};
  for (var i = 0; i < style.length; i++) {
    var key = style[i];
    copiedStyle[key] = style.getPropertyValue(key);
  }
  return copiedStyle;
}

function firstChildTag(element){
  let firstChild = element.firstElementChild;
  if (firstChild){
    return firstChild.nodeName;
  }
  else{
    return "";
  }
}

function getText(element){
  var nodes = element.childNodes;
  var text = [];
  
  for(var i = 0; i < nodes.length; i++) {
      if(nodes[i].nodeType == 3) { 
          text.push(nodes[i].nodeValue);
      }
  }
  return text;
}

function getID(element){
  let id = element.id;
  return id;
}

function CSSClass(element){
  const cssCl = element.classList;
  return cssCl;
}

function className(element){
  const clName = element.className;
  return clName;
}

function childrenCount(element){
  let count = element.childElementCount;
  return count;
}

function getChildren(element){
  var children = [];
  children = element.childNodes;
  return children;
}

function getChildrenTags(element){
  var childTags = [];
  children = element.childNodes;
  for(var child of children){
    childTags.push(child.nodeName);
  }
  return childTags;
}

function parentNode(element){
  var parent = element.parentNode;
  return parent;
}

function getParentElements(element){
  // zbytecne dlouha verze getParents(element)
  var parents = [];
  while (element) {
      parents.unshift(element);
      element = element.parentNode;
  }
  return parents;
}

function getParentTags(element){
  var parTags = [];
  while(element.parentNode && element.parentNode.nodeName.toLowerCase() != 'body') {
    element = element.parentNode;
    // poradi od body -> element
    parTags.unshift(element.nodeName);
  }
  return parTags;
}

function getParents(element){
  var parents = [];
  while(element.parentNode && element.parentNode.nodeName.toLowerCase() != 'body') {
    element = element.parentNode;
    parents.push(element);
  }
  return parents;
}

function separateIDFeatures(elem, elemToAppend){
  let masapiID;
  if (elem.getAttribute('data-masapi-id') == undefined){
    masapiID = elem['data-masapi-id'].split('-');
    elemToAppend['data-masapi-id'] = elem['data-masapi-id'];
  }
  else{
    masapiID = elem.getAttribute('data-masapi-id').split('-');
  }
  for (i in masapiID){
    key = 'masapiID' + i;
    elemToAppend[key] = masapiID[i];
  }
}

function separateParentFeatures(elemToAppend){
  let parentArr = elemToAppend['parentTags'];
  for (i in parentArr){
    key = 'masapiParent' + i;
    elemToAppend[key] = parentArr[i];
  }
}

function separateChildrenFeatures(elemToAppend){
  let childrenArr = elemToAppend['childrenTags'];
  for (i in childrenArr){
    key = 'masapiChild' + i;
    elemToAppend[key] = childrenArr[i];
  }
}

function appendStyleAttributes(elem, elemToAppend){
  var style = getComputedStyle(elem); // getcomputedstyle vraci cisla s nazvy trid a nasledne tridy (nektere jine) s jejich hodnotami 
  var copiedStyle = JSON.parse(JSON.stringify(style));  // getcomputedstyle je read-only

  for (let key in copiedStyle) {
    if (/^\d$/.test(key.charAt(0))) {    // mazu keys, ktere jsou jenom cisla
      delete copiedStyle[key];
    }
  }
  // separace stylovych featur do jednotlivych attrs
  separateStyleVals = Object.entries(copiedStyle) // entries vraci [k, v] dvojice z properties objektu
  for (i=0; i < separateStyleVals.length; i++) {
    key = separateStyleVals[i][0];
    val = separateStyleVals[i][1];
    elemToAppend[key] = val;
  }
}

function createJSON(obj){
  var strObj = JSON.stringify(obj);
  return strObj;
}
