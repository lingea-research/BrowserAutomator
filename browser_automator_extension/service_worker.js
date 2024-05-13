var tab_vals = {};
var recordings_list, classifier_list, datasets_list;

console.log(tab_vals)

/*
// for testing http messages
var messageToServer = new Object();
messageToServer.type = 'get_replay_status'
messageToServer.content = ''//{file_type: ''}
var JSONtoServer = JSON.stringify(messageToServer)
console.log(JSONtoServer)
sendToServer(JSONtoServer);
*/

// listener na vytvoreni noveho tabu navigaci,
// presmerovani pri nahravani
chrome.webNavigation.onCreatedNavigationTarget.addListener(function(details){
  let sourceTabId = details.sourceTabId;
  let tabid = details.tabId;
  let recording = checkTabVals(sourceTabId);
  let windowHeight = tab_vals[sourceTabId].windowHeight;
  let windowWidth = tab_vals[sourceTabId].windowWidth;
  let zoom = tab_vals[sourceTabId].zoom;
  let recid = tab_vals[sourceTabId].recid
  console.log('sourceTabId:', sourceTabId);
  console.log('sourceTabId recording', recording)

  if (recording == true){
    startTrackingRecTab(tabid, recid, recording,  windowHeight, windowWidth, zoom);
    tab_vals[sourceTabId].recording = false;
    tab_vals[sourceTabId].state = 'starting';
  }
  return true;
})

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  // console.log('sender id', sender)
  if (message.type === 'check_recording_selecting') { // zprava po doc ready (proklik na novou stranku)
    var tabid = sender.tab.id; 
    chrome.tabs.query({currentWindow: true}, function(tabs){ // pro cteni aktualni zalozky
      if (tab_vals[tabid] == undefined){
        sendResponse({recording: undefined, selecting: undefined});
      }
      else{
        let recording = tab_vals[tabid].recording;
        let selecting = tab_vals[tabid].selecting;
        sendResponse({recording: recording, selecting: selecting});
      }
    });
    return true;  // jinak "Unchecked runtime.lastError: The message port closed before a response was received."
  }
  else if (message.type === 'update_state') {
    var tabid;
    chrome.tabs.query({active: true, currentWindow: true}, function(tabs){
      tabid = tabs[0].id;
      tab_vals[tabid].state = message.state;
      console.log(tab_vals[tabid].state)
      if (message.loaded_clf){
        tab_vals[tabid].loaded_clf = message.loaded_clf;
      }
    })
  }
  else if (message.type === 'recording_val_from_popup') { // aktualizace value po zahajeni/ vypnuti v popupu
    var tabid;
    var recording = message.recording;
    chrome.tabs.query({active: true, currentWindow: true}, function(tabs){
      tabid = tabs[0].id;
      if (recording == true){ // zahajeni nahravani kliknutim
        // vytvoreni kostry noveho recordingu v tabu
        startTrackingRecTab(tabid, tabid, recording)
      }
      else{ // ukonceni nahravani v popupu
        var scnName = message.scnName;
        tab_vals[tabid].recording = message.recording;
        tab_vals[tabid].scnName = scnName;
        tab_vals[tabid].state = 'starting';
        // TODO: odesilani tady nebo v message recording_approval?
      }
    });
    return true; 
  }
  else if (message.type === 'startingURL'){
    var tabid = sender.tab.id; 
    chrome.tabs.query({currentWindow: true}, function(tabs){
      //tabid = tabs[0].id;
      tab_vals[tabid].startingURL = message.startingURL;
      tab_vals[tabid].windowHeight = message.windowHeight;
      tab_vals[tabid].windowWidth = message.windowWidth;
      sendResponse(message.startingURL);

      // vytvoreni noveho nahravani na serveru
      var messageToServer = new Object();
      messageToServer.type = 'new_recording';
      messageToServer.content = tab_vals[tabid];
      sendToServer(messageToServer, tabid);
      console.log('new_recording JSON: ');
      console.log(JSONtoServer);
      //tab_vals[tabid].startingURL = undefined; // ? k rozpoznavani noveho rec v tabu
    });
    return true;
  }
  else if(message.type === 'elemCount'){
    var tabid = sender.tab.id; 
    chrome.tabs.query({currentWindow: true}, function(tabs){
      //tabid = tabs[0].id;
      tab_vals[tabid].elemCount = message.elemCount;
      tab_vals[tabid].iter = 0; // pro pocitani elementu pri odesilani na server
      tab_vals[tabid].elements = [];  //JSONtoServer -> elements
      sendResponse(tab_vals[tabid].elemCount);
    });
    return true;  
  }
  else if(message.type === 'send_elems_to_server'){
    var receivedElem = message.element;
    var tabid = sender.tab.id; 
    chrome.tabs.query({currentWindow: true}, function(tabs){
      //tabid = tabs[0].id;
      tab_vals[tabid].elements.push(receivedElem);
      tab_vals[tabid].iter += 1;
      if (tab_vals[tabid].iter == tab_vals[tabid].elemCount){
        var messageToServer = new Object();
        messageToServer.type = 'elements_to_classify';
        messageToServer.content = tab_vals[tabid];
        if (tab_vals[tabid].hasOwnProperty('curr_condition_idx')){
          let current_condition = tab_vals[tabid].allSuggested[tab_vals[tabid].curr_condition_idx]
          messageToServer.content.current_condition = current_condition;
        }
        sendToServer(messageToServer, tabid);    // tabid, at vim, kam patri response ze serveru
        console.log('poslano', JSONtoServer);

        //tab_vals[tabid].elements = []; // mazu, at pri posilani approvalu neposilam zbytecne elementy (pomale + mozna kontrola savenuti vyberu bez kliknuti)
        tab_vals[tabid].elemCount = 0;
        tab_vals[tabid].iter = 0;
        tab_vals[tabid].elements = []; 
      }
    });
    return true;  
  }
  else if(message.type === 'action_performed'){
    var tabid; 
    chrome.tabs.query({active: true, currentWindow: true}, function(tabs){
      tabid = tabs[0].id;
      delete message.type // can iterate over other attrs and save to action JSON
      var action = new Object();
      for (const [key, value] of Object.entries(message)){
        action[key] = value;
      }
      console.log(action)
      console.log(action.action)

      if (action.action == 'conditioned_classifier'){
        var messageToServer = new Object();
        messageToServer.type = 'action';

        action.condition = tab_vals[tabid].loaded_clf;

        tab_vals[tabid].action = action;
        messageToServer.content = tab_vals[tabid];
        sendToServer(messageToServer, tabid);    // tabid, at vim, kam patri response ze serveru
        
        console.log('action JSON: ', JSONtoServer)
        
        delete tab_vals[tabid].loaded_clf;
      }
      else if (action.action == 'classifier_used'){
        // pouze provedena klasifikace ulozenym clf -> zmacknuto Continue
        var messageToServer = new Object();
        messageToServer.type = 'action';

        action.action = 'classifier'
        action.classifier = tab_vals[tabid].loaded_clf;

        tab_vals[tabid].action = action;
        messageToServer.content = tab_vals[tabid];
        sendToServer(messageToServer, tabid);    // tabid, at vim, kam patri response ze serveru
        
        console.log('action JSON: ', JSONtoServer)
        
        delete tab_vals[tabid].loaded_clf;
      }
      else if (action.action == 'open_browser'){
        chrome.tabs.getZoom(tabid, function(tab_zoom) {
          let zoom = parseFloat(tab_zoom.toFixed(2)); // zaokrouhleni na 2 des. mista
          // TODO: pri zoomu na 110% v confirmu vypisuje 110.00000001, jinak funguje ok

          tab_vals[tabid].zoom = zoom;
          // TODO: track and apply zoom changes to every action ?
          if (zoom != 1){
            let change_zoom_text = 'Zoom is set to ' + zoom*100 + ' %.\nRecording with zoom set to 100 % recommended.\nChange zoom to 100 %?'

            if (confirm(change_zoom_text) == true){
              chrome.tabs.setZoom(tabid, 1)
              tab_vals[tabid].zoom = 1;
            }
            else {
              tab_vals[tabid].zoom = zoom;
            }
          }
          action.zoom = tab_vals[tabid].zoom;

          var messageToServer = new Object();
          messageToServer.type = 'action';
          sendResponse(action.focusedElement);
    
          tab_vals[tabid].action = action;
          messageToServer.content = tab_vals[tabid];
          sendToServer(messageToServer, tabid);    // tabid, at vim, kam patri response ze serveru
          
          console.log('action JSON: ', JSONtoServer)
        })
      }
      else {
        var messageToServer = new Object();
        messageToServer.type = 'action';
        sendResponse(action.focusedElement);

        if (tab_vals[tabid].loaded_clf){
          // akce nacteni klasifikatoru
          let action_after_clf = action;

          // poslani akce klasifikatoru
          var messageToServer = new Object();
          messageToServer.type = 'action';
          action = new Object();
          action.action = 'classifier';
          action.classifier = tab_vals[tabid].loaded_clf;

          tab_vals[tabid].action = action;
          messageToServer.content = tab_vals[tabid];
          sendToServer(messageToServer, tabid);    // tabid, at vim, kam patri response ze serveru
          console.log('action JSON: ', JSONtoServer)

          // poslani samotne akce
          tab_vals[tabid].action = action_after_clf;
          messageToServer.content = tab_vals[tabid];
          sendToServer(messageToServer, tabid);    // tabid, at vim, kam patri response ze serveru
          console.log('action JSON: ', JSONtoServer)

          delete tab_vals[tabid].loaded_clf;
        }
        else {
          tab_vals[tabid].action = action;
          messageToServer.content = tab_vals[tabid];
          sendToServer(messageToServer, tabid);    // tabid, at vim, kam patri response ze serveru
          
          console.log('action JSON: ', JSONtoServer)
        }

      }
    });
    return true;
  }
  else if (message.type === 'recording_approval') { // recording ended
    var tabid;
    var scnName = message.scnName;
    var messageToServer = new Object();
    messageToServer.type = 'recording_approval'
    chrome.tabs.query({active: true, currentWindow: true}, function(tabs){
      tabid = tabs[0].id;
      tab_vals[tabid].approval = message.approval;

      tab_vals[tabid].scnName = scnName;

      messageToServer.content = tab_vals[tabid];
      sendToServer(messageToServer, tabid);
      console.log('recording_approval JSON: ');
      console.log(JSONtoServer);
      tab_vals[tabid].approval = false;
    });
    // TODO: dodelat odmazavani z tab_vals - setreni pameti
    return true;
  }
  else if (message.type === 'get_saved_files'){
    // ze serveru
    var tabid;
    let file_type = message.file_type;
    var messageToServer = new Object();
    messageToServer.type = 'get_saved_files';
    messageToServer.content = {file_type: file_type};
    sendToServer(messageToServer, tabid);
    // tabid nevyuzite - list ulozen do globalni promenne v sendToServer
  } 
  else if (message.type === 'get_recordings_list'){
    // z backgroundu do popupu
    sendResponse({recordings_list: recordings_list});
    return true;
  }
  else if (message.type === 'get_classifier_list'){
    // z backgroundu do popupu
    sendResponse({classifier_list: classifier_list});
    return true;
  }
  else if (message.type === 'get_datasets_list'){
    // z backgroundu do popupu
    sendResponse({datasets_list: datasets_list});
    return true;
  }
  else if (message.type === 'chosen_scenario'){
    var chosenScn =  message.chosenScn;
    var URLtype = message.URLtype;
    console.log('URLtype: ', URLtype);
    var tabid;
    var messageToServer = new Object();
    chrome.tabs.query({active: true, currentWindow: true}, function(tabs){
      tabid = tabs[0].id;

      let starting_URL;
      if (URLtype == 'currentURL'){
        starting_URL = tabs[0].url;
      }
      else if (URLtype == 'recordedURL'){
        starting_URL = 'recordedURL'
      }

      messageToServer.type = 'replay_from_extension';
      messageToServer.content = {chosenScn: chosenScn, starting_URL: starting_URL};
      sendToServer(messageToServer, tabid);
    });
    return true;
  }
  else if (message.type === 'selecting_elements'){
    var tabid;
    chrome.tabs.query({active: true, currentWindow: true}, function(tabs){
      tabid = tabs[0].id;
      tab_vals[tabid].selecting = message.selecting;
    })
    if (message.selecting == 'manually'){
      console.log('selecting elements manually')
      var tabid;
      chrome.tabs.query({active: true, currentWindow: true}, function(tabs){ // pro cteni aktualni zalozky
        tabid = tabs[0].id;
        delete tab_vals[tabid].loaded_clf;
      })
    }
    else if (message.selecting == 'classifier' || message.selecting == 'classifier_param'){
      console.log('classifier')
      var tabid;
      chrome.tabs.query({active: true, currentWindow: true}, function(tabs){ // pro cteni aktualni zalozky
        tabid = tabs[0].id;
  
        tab_vals[tabid].iter = 0;
        tab_vals[tabid].elements = [];
        tab_vals[tabid].clfName = '';
        tab_vals[tabid].next = false;

        var messageToServer = new Object();
        messageToServer.type = 'new_classifier'
        messageToServer.content = tab_vals[tabid]
        sendToServer(messageToServer, tabid);
        console.log('new_classifier JSON: ')
        console.log(JSONtoServer)

        //tab_vals[tabid].parameters = [];
        tab_vals[tabid].selCount ++;

        if (message.selecting == 'classifier'){
          delete tab_vals[tabid].loaded_clf;
        }

      })
    }
    return true;
  }
  else if (message.type === 'next_element') { // kliknuty next button
    var tabid;
    chrome.tabs.query({active: true, currentWindow: true}, function(tabs){
      tabid = tabs[0].id;
      tab_vals[tabid].next = true;
      tab_vals[tabid].curr_condition_idx += 1;

      var condition = tab_vals[tabid].parameters[tab_vals[tabid].curr_condition_idx];
      if (condition){
        chrome.tabs.sendMessage(tabs[0].id, {condition: condition, type: 'highlight_condition'});  

        var messageToServer = new Object();
        messageToServer.type = 'elements_to_classify';
        messageToServer.content = tab_vals[tabid];
        sendToServer(messageToServer, tabid);
        console.log(JSONtoServer);
        tab_vals[tabid].next = false;
      }
      else{
        alert('No other parameters!')
      }
    });
    return true;
  }
  else if (message.type === 'set_parameters') { // z pop-upu
    // nastaveni parametru do tab_vals
    var tabid;

    chrome.tabs.query({active: true, currentWindow: true}, function(tabs){
      tabid = tabs[0].id;
      tab_vals[tabid].parameters = tab_vals[tabid].allSuggested;
      tab_vals[tabid].curr_condition_idx = 0;

      var condition = tab_vals[tabid].parameters[tab_vals[tabid].curr_condition_idx];
      chrome.tabs.sendMessage(tabs[0].id, {condition: condition, type: 'highlight_condition'});  
    });
  }
  else if (message.type === 'load_classifier_elems') {
    var tabid = sender.tab.id;
    var classifier = message.classifier;
    var receivedElem = message.element;

    chrome.tabs.query({currentWindow: true}, function(tabs){
      tab_vals[tabid].elements.push(receivedElem);
      tab_vals[tabid].iter += 1;
      if (tab_vals[tabid].iter == tab_vals[tabid].elemCount){
        var messageToServer = new Object();
        messageToServer.type = 'load_classifier_elems';
        messageToServer.content = {classifier: classifier, elements: tab_vals[tabid].elements};
        sendToServer(messageToServer, tabid);    // tabid, at vim, kam patri response ze serveru
        console.log('poslano', JSONtoServer);

        //tab_vals[tabid].elements = []; // mazu, at pri posilani approvalu neposilam zbytecne elementy (pomale + mozna kontrola savenuti vyberu bez kliknuti)
        tab_vals[tabid].elemCount = 0;
        tab_vals[tabid].iter = 0;
        tab_vals[tabid].elements = []; 
      }
    });
  }
  else if (message.type === 'stop_selecting'){
    var tabid;
    chrome.tabs.query({active: true, currentWindow: true}, function(tabs){
      tabid = tabs[0].id;
      tab_vals[tabid].selecting = false;

      //tab_vals[tabid].selCount++;
    })
    return true;
  }
  else if (message.type === 'classifier_finished') {
    var tabid;
    var clfName = message.clfName;
    var messageToServer = new Object();
    messageToServer.type = 'classifier_finished'
      chrome.tabs.query({active: true, currentWindow: true}, function(tabs){
        tabid = tabs[0].id;
        tab_vals[tabid].approval = message.approval;
        tab_vals[tabid].parameters = [];

        //tab_vals[tabid].allSuggested[tab_vals[tabid].selCount + 1] = '';

        if (typeof clfName !== 'undefined'){
          tab_vals[tabid].clfName = clfName;
        }

        messageToServer.content = tab_vals[tabid]
        sendToServer(messageToServer, tabid);
        console.log('classifier_finished JSON: ')
        console.log(JSONtoServer)
        tab_vals[tabid].approval = false;
        // TODO: prozatim kvuli podminenym
        tab_vals[tabid].selCount = 0;
        delete tab_vals[tabid].curr_condition_idx;
      });
    return true;
  }
  else if (message.type === 'get_state') {
    // dotaz buttonu z pop upu, zadny obsah
    var tabid;
    var messageToServer = new Object();
    chrome.tabs.query({active: true, currentWindow: true}, function(tabs){
      tabid = tabs[0].id;
      if(tabid in tab_vals){
        sendResponse({state: tab_vals[tabid].state});
      }
      else{
        sendResponse({state: undefined});
      }
    });
    return true;
  }
});
function checkTabVals(sourceTabId){
  // v zalozkach zatim neprobehlo rec ani repl -> nemam o nich info
  if (tab_vals[sourceTabId] == undefined){
    recording = false
  }
  // uz mam info
  else{
    recording = tab_vals[sourceTabId].recording
  }
  return recording
}
function startTrackingRecTab(tabid, recid, recording, windowHeight = 0, windowWidth = 0, zoom = 0){
  var curr_tab = {};
  curr_tab.tabid = tabid;
  curr_tab.windowHeight = windowHeight
  curr_tab.windowWidth = windowWidth
  curr_tab.zoom = zoom
  curr_tab.recording = recording;
  // recording id if recording continues in another tab
  curr_tab.recid = recid;
  curr_tab.last_action = false;
  curr_tab.startingURL = '';
  curr_tab.next = false;
  curr_tab.clfName = '';
  curr_tab.parameters = [];
  curr_tab.iter = 0;
  curr_tab.approval = false;
  curr_tab.state = 'recording_without_selecting';
  curr_tab.allSuggested = {};
  curr_tab.selections = {};
  curr_tab.selID = -1; // po prvnim spusteni vyberu se dostanu na 0
  curr_tab.scnName = '';
  curr_tab.elements = [];
  curr_tab.action = undefined;
  tab_vals[tabid] = curr_tab;
}

function sendToServer(data, tabid){
  // tabid, at vim, kam patri response ze serveru
  var xhr = new XMLHttpRequest();
  var URL = "http://localhost:8081/automator/";

  xhr.open("POST", URL, true);

  xhr.onreadystatechange = function() { // Call a function when the state changes.
    if (this.readyState === XMLHttpRequest.DONE && this.status === 200) {
      //console.log("prijato ze serveru: ");
      //console.log(xhr.responseText);
      var response_message = {}
      if (xhr.responseText != ''){ // priprava pro suggested, all_clf_names, ...
        response_message = JSON.parse(xhr.responseText);
      }
      else { // pridani prazdnych suggested -> nese informaci do content-scriptu
        suggested = '';
        tab_vals[tabid].allSuggested[tab_vals[tabid].selCount] = suggested;
        console.log(tab_vals[tabid]) 
        chrome.tabs.query({active: true, currentWindow: true}, function(tabs){
          chrome.tabs.sendMessage(tabs[0].id, {allSuggested: tab_vals[tabid].allSuggested, type: 'suggested_elements'}, function(response) {
            //console.log('response na suggested: ', response);
          });  
        });
      }
      if (response_message['type'] == 'suggested_elems'){
        suggested = response_message['content']
        // TODO: zmenit .allSuggested pro retezeni vice podminenych
        // - asi uz posilat natridene k sobe z pythonu -pak resit zobrazovani v contentu
        tab_vals[tabid].allSuggested = suggested;
        console.log(tab_vals[tabid]) 
        chrome.tabs.query({active: true, currentWindow: true}, function(tabs){
          chrome.tabs.sendMessage(tabs[0].id, {allSuggested: tab_vals[tabid].allSuggested, type: 'suggested_elements'}, function() {
          });  
        });
      }
      else if (response_message['type'] == 'loaded_clf_elems'){
        let suggested = response_message['content']
        // TODO: zmenit .allSuggested pro retezeni vice podminenych
        // - asi uz posilat natridene k sobe z pythonu -pak resit zobrazovani v contentu
        tab_vals[tabid].allSuggested = suggested;
        console.log('suggested:', suggested)
        chrome.tabs.query({active: true, currentWindow: true}, function(tabs){
          chrome.tabs.sendMessage(tabs[0].id, {suggested: suggested, type: 'highlight_loaded_clf'});  
        });
        //tab_vals[tabid].allSuggested[tab_vals[tabid].selCount].shift();
      }
      else if (response_message['type'] == 'get_saved_files'){
        let file_type = response_message['content']['file_type'];
        if (file_type == 'clfs'){
          classifier_list = response_message['content']['file_list'];
        }
        else if (file_type == 'recordings'){
          recordings_list = response_message['content']['file_list'];
        }
        else if (file_type == 'datasets'){
          datasets_list = response_message['content']['file_list'];
        }
      }
      else if (response_message['type'] == 'replay_from_extension'){
        console.log('replay in driver finished')
      }
      /*
      // pro testovani posilani http messages
      else if (response_message['type'] == 'get_replay_status'){
        console.log('get_replay_status', response_message['content'])
      }
      */
    }
  }

  let formData = new FormData();
  for (const key in data) {
    formData.append(key, JSON.stringify(data[key]));
  }

  xhr.send(formData);
  console.log('SENT DATA: ', formData)
  console.log("sendToServer result:");
  console.log(xhr);
}


