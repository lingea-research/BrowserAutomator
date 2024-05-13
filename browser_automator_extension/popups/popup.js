var recording;
var approval = false;
var chosenScn, chosenParam;
// TODO: delete approval?

var startScnBtn;
var nextBtn;
var mainLabel;
var dontSaveBtn;
var elementSelectionBtn;
var openInNewTabBtn;
var datasetsBtn, nextParamBtn, getDatasetBtn;
var manuallyBtn, useSavedClfBtn, trainClfBtn, trainParamClfBtn, useClfBtn;
var withBtn, withoutBtn;
var saveClfBtn, dontSaveClfBtn;
var continueBtn;


let startBtn = document.getElementById('start-button');
startBtn.classList.add('button', 'big');
startBtn.addEventListener('click', record);

let replayBtn = document.getElementById('replay-button');
replayBtn.classList.add('button', 'big');
replayBtn.addEventListener('click', showSavedRecordings);

let div = document.getElementById('some-div');

// get values when popup is opened
// na bg
chrome.runtime.sendMessage({type: 'get_state'}, (response) => {
  var state = response.state;
  console.log('state:', state)

  if (state == undefined || state == 'starting'){
    defaultHtml();
    approval = false;
    chrome.runtime.sendMessage({type: 'get_saved_files', file_type: 'recordings'})
    // pouze rozkaz k ziskani ze serveru na bg
  }
  else if (state == 'recording_without_selecting'){
    recordingHtml();
    approval = true;
  }
  else if (state == 'selecting_options'){
    selectingElementsHtml()
  }
  else if (state == 'manually_selecting'){
    saveOrBackHtml()
  }
  else if (state == 'actions_after_selecting'){
    actionsAfterSelectingHtml()
  }
  else if (state == 'actions_after_classifier'){
    actionsAfterClassifierHtml()
  }
  else if (state == 'how_to_train_clf'){
    howToTrainClfHtml()
  }
  else if (state == 'dataset_options'){
    datasetsHtml()
  }
  else if (state == 'training_classifier'){
    trainingHtml();
  }
  else if (state == 'loaded_clfs_to_classify'){
    // get saved clfs
    chrome.runtime.sendMessage({type: 'get_classifier_list'}, (response) => {
      var classifier_list = response.classifier_list;
      
      // check if any saved clfs
      if (classifier_list != undefined){
        loadedClfsHtml(action = 'classifyOnly', classifier_list);
      }
      else{
        //edit html
        noClfsLoadedHtml()
      }
    })
  }
  else if (state == 'loaded_clfs_as_parameter'){
    // get saved clfs
    chrome.runtime.sendMessage({type: 'get_classifier_list'}, (response) => {
      var classifier_list = response.classifier_list;
      
      // check if any saved clfs
      if (classifier_list != undefined){
        loadedClfsHtml(action = 'useAsParameter', classifier_list);
      }
      else{
        //edit html
        noClfsLoadedHtml()
      }
    })
  }
  else if (state == 'training_classifier_with_parameters'){
    trainingParamHtml();
  }
});

function record(){
  // start recording
  recording = true;
  console.log('recording: ', recording)

  // na background
  chrome.runtime.sendMessage({recording: recording, type: 'recording_val_from_popup'})

  // do content-scriptu
  chrome.tabs.query({active: true, currentWindow: true},function(tabs) {  // zahajeni v content scriptu
    chrome.tabs.sendMessage(tabs[0].id, {recording: recording, type: 'recording_from_popup'}, function(response) {
        //console.log(response);
    });
  }); 
  // edit html

  recordingHtml()
  approval = true;
  startBtn.removeEventListener('click', record);
  startBtn.addEventListener('click', saveScenario);
}

function saveScenario(){
  var scnName;

  var current_date = getCurrDate();
  scnName = window.prompt('Name this scenario:', 'Scenario_' + current_date);

  if (scnName === null){ // null - if Cancel is clicked
    // nothing happens, recording continues
  }
  else{
    recording = false;
    approval = true;

    // send msgs
    chrome.runtime.sendMessage({recording: recording, scnName: scnName, type: 'recording_val_from_popup'})

    chrome.tabs.query({active: true, currentWindow: true},function(tabs) {  // odeslani do content scriptu 
      chrome.tabs.sendMessage(tabs[0].id, {recording: recording, type: 'recording_from_popup'}, function(response) {
          //console.log(response);
      });
    }); 
    chrome.runtime.sendMessage({approval: approval, scnName: scnName, type: 'recording_approval'}, (response) => {  // odeslani na background -> flask
      //console.log('response na approval z backgroundu: ', response);
    });
  
    // edit html
    defaultHtml()
    dontSaveBtn.remove();
    elementSelectionBtn.remove();
    approval = false;
  }
}

function dontSaveScenario(){
  recording = false;
  approval = false;

  // send msgs
  chrome.runtime.sendMessage({recording: recording, scnName: null, type: 'recording_val_from_popup'})

  chrome.tabs.query({active: true, currentWindow: true},function(tabs) {  // odeslani do content scriptu
    chrome.tabs.sendMessage(tabs[0].id, {recording: recording, type: 'recording_from_popup'}, function(response) {
        //console.log(response);
    });
  }); 
  chrome.runtime.sendMessage({approval: approval, scnName: null, type: 'recording_approval'}, (response) => {  // odeslani na background -> flask
    //console.log('response na approval z backgroundu: ', response);
  });

  // edit html
  defaultHtml()
  dontSaveBtn.remove();
  elementSelectionBtn.remove();
  approval = false;
}

function showSavedRecordings(){
  // get saved recording
  chrome.runtime.sendMessage({type: 'get_recordings_list'}, (response) => {
    var recordings_list = response.recordings_list;
    console.log('recordings_list', recordings_list)
    
    // check if any saved recordings
    if (recordings_list != undefined){
      // create labels and radios for recordings
      for (var i = 0; i < recordings_list.length; i++){
        var name = recordings_list[i];

        const recLabel = document.createElement('label');
        recLabel.setAttribute('for', name);
        recLabel.classList.add('inputlabel');

        const recRadio = document.createElement('input');
        recRadio.setAttribute('type', 'radio');
        recRadio.setAttribute('name', 'recRadio');
        recRadio.setAttribute('id', name);
        recRadio.setAttribute('value', name);
        
        recLabel.appendChild(recRadio);
        recLabel.innerHTML = recLabel.innerHTML + name;

        div.appendChild(recLabel);
      }
      // edit html
      loadedRecordingsHtml()
    }
    else{
      //edit html
      noRecordingLoadedHtml()
    }
  });
}

function defaultHtml(){
  // show btns
  startBtn.style.display = 'block';
  replayBtn.style.display = 'block';
  
  // startBtn
  startBtn.innerHTML= "Start recording";
  //startBtn.style.outlineColor = "darkgrey";
  startBtn.removeEventListener('click', saveScenario);
  startBtn.addEventListener('click', record);

  // doc size
  document.documentElement.style.height = '140px';
  document.body.style.height = '140px';
}

function recordingHtml(){
  // edit bttns
  startBtn.innerHTML = "Save";
  replayBtn.style.display = 'none';

  elementSelectionBtn = document.createElement('button');
  elementSelectionBtn.innerHTML = 'Select elements';
  elementSelectionBtn.classList.add('button', 'big');
  elementSelectionBtn.addEventListener('click', selectingElements);
  div.appendChild(elementSelectionBtn);

  dontSaveBtn = document.createElement('button');
  dontSaveBtn.innerHTML = 'Do not save';
  dontSaveBtn.classList.add('button', 'big');
  dontSaveBtn.addEventListener('click', dontSaveScenario);
  div.appendChild(dontSaveBtn);
  
  startBtn.removeEventListener('click', record);
  startBtn.addEventListener('click', saveScenario);
  
  // doc size
  document.documentElement.style.height = '200px';
  document.documentElement.style.width = '180px';
  document.body.style.height = '200px';
  document.body.style.width = '180px';
  div.style.height = '200px';
  div.style.width = '180px';

  // TODO: posilat zaroven s recording_listem?, za sebou nefunguje
  chrome.runtime.sendMessage({type: 'get_saved_files', file_type: 'clfs'})
  // pouze rozkaz k ziskani ze serveru na bg
}

function selectingElementsHtml(){
  // hide btns
  startBtn.style.display = 'none';
  replayBtn.style.display = 'none';

  // create buttons
  manuallyBtn = document.createElement('button');
  manuallyBtn.innerHTML = 'Manually';
  manuallyBtn.classList.add('button', 'big');
  manuallyBtn.addEventListener('click', selectingManually);
  div.appendChild(manuallyBtn);

  useSavedClfBtn = document.createElement('button');
  useSavedClfBtn.innerHTML = 'Load classifier';
  useSavedClfBtn.classList.add('button', 'big');
  useSavedClfBtn.addEventListener('click', loadSavedClassifier);
  div.appendChild(useSavedClfBtn);

  trainClfBtn = document.createElement('button');
  trainClfBtn.innerHTML = 'Train classifier';
  trainClfBtn.classList.add('button', 'big');
  trainClfBtn.addEventListener('click', howToTrainClf);
  div.appendChild(trainClfBtn);
  
  // doc size
  document.documentElement.style.height = '200px';
  document.body.style.height = '200px';

  //
  // pouze rozkaz k ziskani ze serveru na bg
  chrome.runtime.sendMessage({type: 'get_saved_files', file_type: 'datasets'})
}

function howToTrainClf(){
  // na bg
  chrome.runtime.sendMessage({state: 'how_to_train_clf', type: 'update_state'})
  
  //delete btns
  manuallyBtn.remove();
  useSavedClfBtn.remove();
  trainClfBtn.remove();

  howToTrainClfHtml()
}

function howToTrainClfHtml(){
  // hide btns
  startBtn.style.display = 'none';
  replayBtn.style.display = 'none';

  //add btns
  withoutBtn = document.createElement('button');
  withoutBtn.innerHTML = 'Train new';
  withoutBtn.classList.add('button',  'big');
  withoutBtn.addEventListener('click', trainWithoutParameters);
  div.appendChild(withoutBtn);

  /*
  withBtn = document.createElement('button');
  withBtn.innerHTML = 'Use parameters';
  withBtn.classList.add('button', 'big');
  withBtn.addEventListener('click', trainWithParameters);
  div.appendChild(withBtn);
  */

  // doc size
  document.documentElement.style.height = '80px';
  document.body.style.height = '80px';
}

function loadSavedClassifier(){
  //delete btns
  manuallyBtn.remove();
  useSavedClfBtn.remove();
  trainClfBtn.remove();

  // na bg
  chrome.runtime.sendMessage({state: 'loaded_clfs_to_classify', type: 'update_state'})

  // get saved clfs
  chrome.runtime.sendMessage({type: 'get_classifier_list'}, (response) => {
    var classifier_list = response.classifier_list;
    
    // check if any saved clfs
    if (classifier_list != undefined){
      loadedClfsHtml(action = 'classifyOnly', classifier_list);
    }
    else{
      //edit html
      noClfsLoadedHtml()
    }
  })
}

function trainWithoutParameters(){
  startTraining(Parameters = false);
  chrome.runtime.sendMessage({state: 'training_classifier', type: 'update_state'})
}

function trainWithParameters(){
  // TODO odamazat ify po odstraneni moznosti 'Use as parameter'
  // delete btns
  if(withBtn){withBtn.remove();}
  if(withoutBtn){withoutBtn.remove();}
  if(useAsParamBtn){useAsParamBtn.remove();}
  if(addActionBtn){addActionBtn.remove();}
  if(continueBtn){continueBtn.remove();}

  // na bg: set parameters
  chrome.runtime.sendMessage({type: 'set_parameters'})

  // na bg
  chrome.runtime.sendMessage({state: 'training_classifier_with_parameters', type: 'update_state'})

  startTraining(Parameters = true)
}

function loadedClfsHtml(action, classifier_list){
  // hide btns
  startBtn.style.display = 'none'
  replayBtn.style.display = 'none'

  // create labels and radios for clfs
  for (var i = 0; i < classifier_list.length; i++){
    var name = classifier_list[i];

    const clfLabel = document.createElement('label');
    clfLabel.setAttribute('for', name);
    clfLabel.classList.add('inputlabel');

    const clfRadio = document.createElement('input');
    clfRadio.setAttribute('type', 'radio');
    clfRadio.setAttribute('name', 'clfRadio');
    clfRadio.setAttribute('id', name);
    clfRadio.setAttribute('value', name);
    
    clfLabel.appendChild(clfRadio);
    clfLabel.innerHTML = clfLabel.innerHTML + name;

    div.appendChild(clfLabel);
  }

  // create label
  mainLabel = document.createElement('label');
  mainLabel.innerHTML = 'Choose classifier:';
  mainLabel.classList.add('largelabel');
  document.body.insertBefore(mainLabel, div);

  // doc size + properties
  document.documentElement.style.height = '340px';
  document.documentElement.style.width = '270px';
  document.body.style.height = '340px';
  document.body.style.width = '270px';
  div.style.cssText = 'overflow-y: scroll';
  div.style.height = '280px';
  div.style.width = '270px';

  if (action == 'classifyOnly'){
    //create btn
    useClfBtn = document.createElement('button');
    useClfBtn.innerHTML = 'Classify';
    useClfBtn.classList.add('button', 'medium');
    useClfBtn.addEventListener('click', getChosenClassifier);
    document.body.appendChild(useClfBtn);
  }
}

function actionsAfterClassifierHtml(){
  // edit html
  startBtn.style.display = 'none'
  replayBtn.style.display = 'none'

  // create buttons
  useAsParamBtn = document.createElement('button');
  useAsParamBtn.innerHTML = 'Use as a parameter';
  useAsParamBtn.classList.add('button', 'big');
  useAsParamBtn.addEventListener('click', trainWithParameters);

  div.appendChild(useAsParamBtn);

  addActionBtn = document.createElement('button');
  addActionBtn.innerHTML = 'Add action';
  addActionBtn.classList.add('button', 'big');
  addActionBtn.addEventListener('click', showActions);

  div.appendChild(addActionBtn);

  continueBtn = document.createElement('button');
  continueBtn.innerHTML = 'Continue';
  continueBtn.classList.add('button', 'big');
  continueBtn.addEventListener('click', saveClfOnly);

  div.appendChild(continueBtn);

  // doc size
  document.documentElement.style.height = '220px';
  document.documentElement.style.width = '180px';
  document.body.style.height = '220px';
  document.body.style.height = '180px';
  div.style.height = '220px';
  div.style.width = '180px';
}

function showActions(){
  // update bg
  chrome.runtime.sendMessage({state: 'actions_after_selecting', type: 'update_state'})

  // kvuli load clf
  // do content scriptu
  chrome.tabs.query({active: true, currentWindow: true},function(tabs) { 
    chrome.tabs.sendMessage(tabs[0].id, {type: 'stop_training_classifier'});
  }); 

  // edit html
  startBtn.style.display = 'block';

  useAsParamBtn.remove();
  addActionBtn.remove();
  continueBtn.remove();

  actionsAfterSelectingHtml()
}

function saveClfOnly(){
  // update bg
  chrome.runtime.sendMessage({state: 'recording_without_selecting', type: 'update_state'})

  // kvuli load clf
  // do content scriptu
  chrome.tabs.query({active: true, currentWindow: true},function(tabs) { 
    chrome.tabs.sendMessage(tabs[0].id, {type: 'stop_training_classifier'});
  }); 

  // odeslani na background -> flask
  // pouze provedena klasifikace ulozenym clf -> zmacknuto Continue
  chrome.runtime.sendMessage({action: 'classifier_used',
                              type: 'action_performed'
  })

  // edit html
  startBtn.style.display = 'block';

  useAsParamBtn.remove();
  addActionBtn.remove();
  continueBtn.remove();

  recordingHtml()
}

function getChosenClassifier(){
  // get clf
  let clfName = div.querySelector("input[type='radio'][name=clfRadio]:checked").value;

  /*
  // send to bg -> server
  chrome.runtime.sendMessage({classifier: clfName,
                              action: 'classifier',
                              type: 'action_performed'
  })
  */

  // do content scriptu
  chrome.tabs.query({active: true, currentWindow: true},function(tabs) {
    chrome.tabs.sendMessage(tabs[0].id, {selecting: 'classifier',
                                        classifier: clfName,
                                        type: 'show_loaded_clf'});
  }); 

  // update bg state
  // na bg ziskam info, ktery clf je nacteny -> pak muzu poslat v akci na server 
  chrome.runtime.sendMessage({state: 'actions_after_classifier',
                              loaded_clf: clfName,
                              type: 'update_state'})

  // edit html
  // clear dataset labels
  document.querySelectorAll('.inputlabel').forEach(e => e.remove());
  div.style.removeProperty('overflow-y');

  // remove
  mainLabel.remove();
  useClfBtn.remove();

  // doc size
  document.documentElement.style.height = '220px';
  document.documentElement.style.width = '180px';
  document.body.style.height = '220px';
  document.body.style.height = '180px';
  div.style.height = '220px';
  div.style.width = '180px';

  actionsAfterClassifierHtml()
}

function noClfsLoadedHtml(){
  // hide btns
  withBtn.remove();
  withoutBtn.remove();

  // create label
  const recLabel = document.createElement('label');
  recLabel.classList.add('largelabel');
  recLabel.innerHTML = 'No saved classifiers.';
  recLabel.style.margin = 'auto'; // centers label in div
  div.appendChild(recLabel);

  // doc size
  div.style.height = '140px';
  div.style.width = '180px';
}

function startingURLHtml(){
  // delete elements and properties
  div.innerHTML = '';
  div.style.removeProperty('overflow-y');
  nextBtn.style.display = 'none';

  // doc size
  document.documentElement.style.height = '190px';
  document.documentElement.style.width = '220px';
  document.body.style.height = '190px';
  document.body.style.width = '220px';

  // change label
  mainLabel.innerHTML = 'Start on:';

  // create labels and radios
  var URLtypes = ['currentURL', 'recordedURL'];
  for (var i = 0; i < URLtypes.length; i++){
    var URLtype = URLtypes[i];

    const URLlabel = document.createElement('label');
    URLlabel.setAttribute('for', URLtype);
    URLlabel.classList.add('inputlabel');

    const URLradio = document.createElement('input');
    URLradio.setAttribute('type', 'radio');
    URLradio.setAttribute('name', 'URLradio');
    URLradio.setAttribute('id', URLtype);
    URLradio.setAttribute('value', URLtype);
    
    URLlabel.appendChild(URLradio);
    URLlabel.innerHTML = URLlabel.innerHTML + URLtype;

    div.appendChild(URLlabel);
  }

  //create btn
  startScnBtn = document.createElement('button');
  startScnBtn.innerHTML = 'Start scenario';
  startScnBtn.classList.add('button', 'medium');
  startScnBtn.addEventListener('click', chooseStartingURL);
  document.body.appendChild(startScnBtn);
}

function whatToSaveHtml(dataset_name){
  // hide btns
  startBtn.style.display = 'none';

  // create label
  mainLabel = document.createElement('label');
  mainLabel.classList.add('largelabel');
  mainLabel.innerHTML = 'Save:';
  document.body.insertBefore(mainLabel, div);

  // create labels and checkboxes
  let options_list = ['outerHTML', 'text']
  for (var i = 0; i < options_list.length; i++){
    var name = options_list[i];

    const optLabel = document.createElement('label');
    optLabel.setAttribute('for', name);
    optLabel.classList.add('inputlabel');

    const optCheckbox = document.createElement('input');
    optCheckbox.setAttribute('type', 'checkbox');
    optCheckbox.setAttribute('name', 'optCheckbox');
    optCheckbox.setAttribute('id', name);
    optCheckbox.setAttribute('value', name);
    
    optLabel.appendChild(optCheckbox);
    optLabel.innerHTML = optLabel.innerHTML + name;

    div.appendChild(optLabel);
  }

  //create btn
  saveBtn = document.createElement('button');
  saveBtn.innerHTML = 'Continue';
  saveBtn.classList.add('button', 'medium');
  saveBtn.setAttribute('value', dataset_name);

  saveBtn.addEventListener('click', getChosenOption);

  document.body.appendChild(saveBtn);

  // doc size + properties
  document.documentElement.style.height = '220px';
  document.documentElement.style.width = '200px';
  document.body.style.height = '220px';
  document.body.style.width = '200px';
  div.style.height = '220px';
  div.style.width = '200px';
}

function getChosenOption(){
  // get option
  let checkedAttributes = div.querySelectorAll("input[type='checkbox'][name=optCheckbox]:checked");
  let dataset_name = saveBtn.value;

  // check if something is checked
  if (checkedAttributes.length != 0){
    // na background
    for (let checkbox of checkedAttributes){
      attribute = checkbox.value;
      chrome.runtime.sendMessage({dataset: dataset_name,
        save: String(attribute),
        action: 'add_to_dataset',
        type: 'action_performed'
      })
    }

    chrome.runtime.sendMessage({state: 'recording_without_selecting', type: 'update_state'})

    // edit html
    mainLabel.remove()
    document.querySelectorAll('.inputlabel').forEach(e => e.remove());
    saveBtn.remove()

    startBtn.style.display = 'block';
    recordingHtml();
  }
  else{
    alert('Choose at least one dataset!')
    
    // edit html
    mainLabel.remove()
    document.querySelectorAll('.inputlabel').forEach(e => e.remove());
    saveBtn.remove()
    startBtn.style.display = 'block';
    whatToSaveHtml(dataset_name)
  }
}

function showSavedDatasets(type){
  chrome.runtime.sendMessage({type: 'get_datasets_list'}, (response) => {
    var datasets_list = response.datasets_list;
    console.log('datasets_list', datasets_list)
    
    // check if any saved recordings
    if (datasets_list.length != 0){
      // create labels and radios for recordings
      for (var i = 0; i < datasets_list.length; i++){
        var name = datasets_list[i];

        const datasetLabel = document.createElement('label');
        datasetLabel.setAttribute('for', name);
        datasetLabel.classList.add('inputlabel');

        const datasetRadio = document.createElement('input');
        datasetRadio.setAttribute('type', 'radio');
        datasetRadio.setAttribute('name', 'datasetRadio');
        datasetRadio.setAttribute('id', name);
        datasetRadio.setAttribute('value', name);
        
        datasetLabel.appendChild(datasetRadio);
        datasetLabel.innerHTML = datasetLabel.innerHTML + name;

        div.appendChild(datasetLabel);
      }
      // edit html
      loadedDatasetsHtml(type)
    }
    else{
      //edit html
      noDatasetLoadedHtml()
    }
  });
}

function loadedDatasetsHtml(type){
  // hide btns
  createBtn.remove();
  appendBtn.remove();

  // create label
  mainLabel = document.createElement('label');
  mainLabel.classList.add('largelabel');
  mainLabel.innerHTML = 'Choose dataset:';
  document.body.insertBefore(mainLabel, div);

  // doc size + properties
  document.documentElement.style.height = '340px';
  document.documentElement.style.width = '270px';
  document.body.style.height = '340px';
  document.body.style.width = '270px';
  div.style.cssText = 'overflow-y: scroll';
  div.style.height = '280px';
  div.style.width = '270px';

  //create btn
  getDatasetBtn = document.createElement('button');
  getDatasetBtn.innerHTML = 'Save';
  getDatasetBtn.classList.add('button', 'medium');
  if (type == 'manual'){
    getDatasetBtn.addEventListener('click', getChosenManualDataset);
  }
  else if (type == 'clf'){
    getDatasetBtn.addEventListener('click', getChosenClfDataset);
  }
  document.body.appendChild(getDatasetBtn);
}

function noDatasetLoadedHtml(){
  // hide btns
  createBtn.remove();
  appendBtn.remove();

  // create label
  const recLabel = document.createElement('label');
  recLabel.classList.add('largelabel');
  recLabel.innerHTML = 'No saved datasets.';
  recLabel.style.margin = 'auto'; // centers label in div
  div.appendChild(recLabel);

  // doc size
  document.documentElement.style.height = '140px';
  document.documentElement.style.width = '180px';
  div.style.height = '140px';
  div.style.width = '180px';
}

function getChosenManualDataset(){
  // get dataset
  dataset_name = div.querySelector("input[type='radio'][name=datasetRadio]:checked").value;

  // send msgs
  // na background
  chrome.runtime.sendMessage({type: 'stop_selecting'}, (response) => {
    //console.log('response: ', response);
  });

  // edit html
  // clear dataset labels
  document.querySelectorAll('.inputlabel').forEach(e => e.remove());

  //div.innerHTML = '';
  div.style.removeProperty('overflow-y');

  // remove
  mainLabel.remove();
  getDatasetBtn.remove();

  // doc size
  document.documentElement.style.height = '200px';
  document.documentElement.style.width = '180px';
  document.body.style.height = '200px';
  document.body.style.width = '180px';
  div.style.height = '200px';
  div.style.width = '180px';

  startBtn.style.display = 'block';
  startBtn.classList.add('button', 'big');

  whatToSaveHtml(dataset_name, selecting_type = 'manual');
}

function getChosenClfDataset(){
  // get dataset
  dataset_name = div.querySelector("input[type='radio'][name=datasetRadio]:checked").value;

  // send msgs
  // na background
  chrome.runtime.sendMessage({type: 'stop_selecting'}, (response) => {
    //console.log('response: ', response);
  });

  // edit html
  // clear dataset labels
  document.querySelectorAll('.inputlabel').forEach(e => e.remove());

  //div.innerHTML = '';
  div.style.removeProperty('overflow-y');

  // remove
  mainLabel.remove();
  getDatasetBtn.remove();

  // doc size
  document.documentElement.style.height = '200px';
  document.documentElement.style.width = '180px';
  document.body.style.height = '200px';
  document.body.style.width = '180px';
  div.style.height = '200px';
  div.style.width = '180px';

  startBtn.style.display = 'block';
  startBtn.classList.add('button', 'big');

  whatToSaveHtml(dataset_name, selecting_type = 'classifier');
}

function actionsAfterSelectingHtml(){
  // edit html
  startBtn.style.display = 'none'
  replayBtn.style.display = 'none'

  // create buttons
  openInNewTabBtn = document.createElement('button');
  openInNewTabBtn.innerHTML = 'Open links in new tabs';
  openInNewTabBtn.classList.add('button', 'big');
  openInNewTabBtn.addEventListener('click', openInNewTabs);

  div.appendChild(openInNewTabBtn);

  datasetsBtn = document.createElement('button');
  datasetsBtn.innerHTML = 'Add elements to dataset';
  datasetsBtn.classList.add('button', 'big');
  datasetsBtn.addEventListener('click', datasetOptions);

  div.appendChild(datasetsBtn);
  
  // doc size
  document.documentElement.style.height = '180px';
  document.body.style.height = '180px';
}

function openInNewTabs(){
  // na background
  chrome.runtime.sendMessage({type: 'stop_selecting'}, (response) => {
    //console.log('response: ', response);
  });

  // na background
  chrome.runtime.sendMessage({action: 'open_in_new_tab', type: 'action_performed'})

  chrome.runtime.sendMessage({state: 'recording_without_selecting', type: 'update_state'})

  //edit html
  startBtn.style.display = 'block';
  openInNewTabBtn.style.display = 'none';
  datasetsBtn.style.display = 'none';
  recordingHtml();
}

function datasetOptions(){
  // na bg
  chrome.runtime.sendMessage({state: 'dataset_options', type: 'update_state'})

  // hide btns
  openInNewTabBtn.style.display = 'none';
  datasetsBtn.style.display = 'none';

  // edit html
  datasetsHtml()
}

function datasetsHtml(){
  startBtn.style.display = 'none';
  replayBtn.style.display = 'none';

  // create buttons
  createBtn = document.createElement('button');
  createBtn.innerHTML = 'Create new dataset';
  createBtn.classList.add('button', 'big');
  createBtn.addEventListener('click', createDataset);
  div.appendChild(createBtn);

  appendBtn = document.createElement('button');
  appendBtn.innerHTML = 'Append to dataset';
  appendBtn.classList.add('button', 'big');
  appendBtn.addEventListener('click', appendToDataset);
  div.appendChild(appendBtn);
  
  // doc size
  document.documentElement.style.height = '180px';
  document.body.style.height = '180px';
}

function createDataset(){
  var current_date = getCurrDate();
  let dataset_name = window.prompt('Name dataset:', 'Dataset_' + current_date);

  if (dataset_name === null){ // null - if Cancel is clicked
    // nothing happens, recording continues
  }
  else{
    // send msgs
    // na background
    chrome.runtime.sendMessage({type: 'stop_selecting'}, (response) => {
      //console.log('response: ', response);
    });

    // edit html
    startBtn.style.display = 'block';
    // hide btns
    createBtn.style.display = 'none';
    appendBtn.style.display = 'none';

    whatToSaveHtml(dataset_name);
  }
}

function appendToDataset(){
  // TODO:
}

function trainingHtml(){
  // hide btns
  startBtn.style.display = 'none';
  replayBtn.style.display = 'none';

  // create buttons
  saveClfBtn = document.createElement('button');
  saveClfBtn.innerHTML = 'Save classifier';
  saveClfBtn.classList.add('button', 'big');
  saveClfBtn.setAttribute('is_conditioned', 'false');
  saveClfBtn.addEventListener('click', saveClassifier);
  div.appendChild(saveClfBtn);
  
  dontSaveClfBtn = document.createElement('button');
  dontSaveClfBtn.innerHTML = 'Do not save';
  dontSaveClfBtn.classList.add('button', 'big');
  dontSaveClfBtn.addEventListener('click', dontSaveClassifier);
  div.appendChild(dontSaveClfBtn);

  // doc size
  document.documentElement.style.height = '140px';
  document.body.style.height = '140px';
}


function trainingParamHtml(){
  // hide btns
  startBtn.style.display = 'none';
  replayBtn.style.display = 'none';

  // create buttons
  nextParamBtn = document.createElement('button');
  nextParamBtn.innerHTML = 'Next';
  nextParamBtn.addEventListener('click', nextParameter);
  nextParamBtn.classList.add('button', 'big');
  div.appendChild(nextParamBtn);

  saveClfBtn = document.createElement('button');
  saveClfBtn.innerHTML = 'Save classifier';
  saveClfBtn.classList.add('button', 'big');
  saveClfBtn.setAttribute('is_conditioned', 'true');
  saveClfBtn.addEventListener('click', saveClassifier);
  div.appendChild(saveClfBtn);

  dontSaveClfBtn = document.createElement('button');
  dontSaveClfBtn.innerHTML = 'Do not save';
  dontSaveClfBtn.classList.add('button', 'big');
  dontSaveClfBtn.addEventListener('click', dontSaveClassifier);
  div.appendChild(dontSaveClfBtn);

  // doc size
  document.documentElement.style.height = '200px';
  document.body.style.height = '200px';
}

function nextParameter(){
  chrome.runtime.sendMessage({type: 'next_element'}, (response) => {  // na background
    //console.log('response na selecting z backgroundu: ', response);
  });
}

function saveClassifier(){
  // name clf
  var clfName;
  var current_date = getCurrDate();
  clfName = window.prompt('Name this classifier', 'Classifier_' + current_date);
  let is_conditioned = saveClfBtn.getAttribute('is_conditioned');
  console.log('is_conditioned', is_conditioned)

  if (clfName === null){ // null - pokud zmacknu Cancel
    // nic se nedeje, pokracuju ve vyberu
  }
  else{
    //selecting = false;
    approval = true;

    // odeslani na background -> flask
    chrome.runtime.sendMessage({approval: approval, clfName: clfName, type: 'classifier_finished'}, (response) => {
      //console.log('response na appr z backgroundu: ', response);
    });

    if (is_conditioned == 'true'){
      console.log(is_conditioned)
      // odeslani na background -> flask
      chrome.runtime.sendMessage({classifier: clfName,
                                  action: 'conditioned_classifier',
                                  type: 'action_performed'
      })
    }
    else {
      console.log(is_conditioned)
      // odeslani na background -> flask
      chrome.runtime.sendMessage({classifier: clfName,
                                  action: 'classifier',
                                  type: 'action_performed'
      })
    }
    chrome.runtime.sendMessage({state: 'actions_after_selecting', type: 'update_state'})

     // odeslani do content scriptu -> save and continue (puvodne)
    chrome.tabs.query({active: true, currentWindow: true},function(tabs) { 
      chrome.tabs.sendMessage(tabs[0].id, {type: 'stop_training_classifier'});
    }); 

    // edit html
    saveClfBtn.remove();
    dontSaveClfBtn.remove();
    // hide btns
    startBtn.style.display = 'none';
    replayBtn.style.display = 'none';

    if (nextParamBtn){
      nextParamBtn.remove()
    }
    actionsAfterSelectingHtml();
    // TODO: dodelat, aby uzivatel musel zvolit, co s elementy, nez se ulozi clf do recordingu
  }
}

function dontSaveClassifier(){
  //selecting = false;
  approval = false;

  // odeslani na background -> flask
  chrome.runtime.sendMessage({approval: approval, type: 'classifier_finished'}, (response) => { 
    //console.log('response na appr z backgroundu: ', response);
  });

  // selecting na background
  chrome.runtime.sendMessage({type: 'stop_selecting'}, (response) => {
    //console.log('response na selecting z backgroundu: ', response);
  });

  chrome.runtime.sendMessage({state: 'recording_without_selecting',type: 'update_state'})

  // odeslani do content scriptu -> ukonceni vyberu
  chrome.tabs.query({active: true, currentWindow: true},function(tabs) {  
    chrome.tabs.sendMessage(tabs[0].id, {type: 'stop_training_classifier'});
  }); 

  // edit html
  saveClfBtn.remove();
  dontSaveClfBtn.remove();
  if (nextParamBtn){
    nextParamBtn.remove();
  }
  startBtn.style.display = 'block';
  recordingHtml();
}

function loadedRecordingsHtml(){
  // hide btns
  startBtn.style.display = 'none';
  replayBtn.style.display = 'none';

  // create label
  mainLabel = document.createElement('label');
  mainLabel.classList.add('largelabel');
  mainLabel.innerHTML = 'Choose scenario:';
  document.body.insertBefore(mainLabel, div);

  // doc size + properties
  document.documentElement.style.height = '340px';
  document.documentElement.style.width = '270px';
  document.body.style.height = '340px';
  document.body.style.width = '270px';
  div.style.cssText = 'overflow-y: scroll';
  div.style.height = '280px';
  div.style.width = '270px';

  //create btn
  nextBtn = document.createElement('button');
  nextBtn.innerHTML = 'Continue';
  nextBtn.classList.add('button', 'medium');
  nextBtn.addEventListener('click', getChosenScenario);
  document.body.appendChild(nextBtn);
}

function noRecordingLoadedHtml(){
  // hide btns
  startBtn.style.display = 'none';
  replayBtn.style.display = 'none';

  // create label
  const recLabel = document.createElement('label');
  recLabel.classList.add('largelabel');
  recLabel.innerHTML = 'No saved scenarios.';
  recLabel.style.margin = 'auto'; // centers label in div
  div.appendChild(recLabel);

  // doc size
  div.style.height = '140px';
  div.style.width = '180px';
}

function chooseStartingURL(){
  // get URL type
  let URLtype = div.querySelector("input[type='radio'][name=URLradio]:checked").value;
  console.log('tady')
  console.log(URLtype)
  //send to bg
  chrome.runtime.sendMessage({chosenScn: chosenScn, URLtype: URLtype, type: 'chosen_scenario'}, (response) => {
    //console.log('response: ', response);
  });

  // edit html
  window.close();
}

function getChosenScenario(){
  // get scn
  chosenScn = div.querySelector("input[type='radio'][name=recRadio]:checked").value;

  // edit html
  startingURLHtml();
}

function getCurrDate(){
  var date = new Date();
  var current_date = ('0' + date.getDate()).slice(-2) + '_' +
                    // '0' a .slice(-2) pro vraceni 2 mistnych hodnot
                    ('0' + (date.getMonth()+1)).slice(-2) + '_' + // + 1 ... months go 0-11
                    date.getFullYear() + '_' +
                    ('0' + date.getHours()).slice(-2) + ':' +
                    ('0' + date.getMinutes()).slice(-2) + ':' +
                    ('0' + date.getSeconds()).slice(-2);
  return current_date
}

function selectingElements(){
  // na background
  chrome.runtime.sendMessage({state: 'selecting_options', type: 'update_state'})

  // edit html

  // hide btns
  startBtn.style.display = 'none';
  replayBtn.style.display = 'none';
  elementSelectionBtn.style.display = 'none';
  dontSaveBtn.style.display = 'none';

  selectingElementsHtml();
}

function selectingManually(){
  // na background
  chrome.runtime.sendMessage({selecting: 'manually', type: 'selecting_elements'}, (response) => {
    //console.log('response: ', response);
  });

  chrome.runtime.sendMessage({state: 'manually_selecting', type: 'update_state'})

  // do content scriptu
  chrome.tabs.query({active: true, currentWindow: true},function(tabs) {
    chrome.tabs.sendMessage(tabs[0].id, {selecting: 'manually', type: 'selecting_elements'}, function(response) {
        //console.log(response);
    });
  }); 

  // edit html
  manuallyBtn.style.display = 'none'
  trainClfBtn.style.display = 'none'
  useSavedClfBtn.remove();

  // doc size
  document.documentElement.style.height = '140px';
  document.documentElement.style.width = '180px';
  document.body.style.height = '140px';
  document.body.style.width = '180px';

  saveOrBackHtml()
}

function saveOrBackHtml(){
  // edit html
  startBtn.style.display = 'none'
  replayBtn.style.display = 'none'

  // create buttons
  saveBtn = document.createElement('button');
  saveBtn.innerHTML = 'Save selection';
  saveBtn.classList.add('button', 'big');
  saveBtn.addEventListener('click', saveSelection);

  dontSaveBtn = document.createElement('button');
  dontSaveBtn.innerHTML = 'Do not save';
  dontSaveBtn.classList.add('button', 'big');
  dontSaveBtn.addEventListener('click', stopSelection);

  div.appendChild(saveBtn);
  div.appendChild(dontSaveBtn);
}

function saveSelection(){
  // na background
  chrome.runtime.sendMessage({type: 'stop_selecting'}, (response) => {
    //console.log('response: ', response);
  });

  chrome.runtime.sendMessage({state: 'actions_after_selecting', type: 'update_state'})


  // do content scriptu
  chrome.tabs.query({active: true, currentWindow: true},function(tabs) {
    chrome.tabs.sendMessage(tabs[0].id, {type: 'stop_selection', todo: 'save'},function(response) {
      // response at je prvni odeslana akce selection
    });
  });

  // edit html
  saveBtn.remove()
  dontSaveBtn.remove()
  actionsAfterSelectingHtml()
}

function stopSelection(){
  // do content scriptu
  chrome.tabs.query({active: true, currentWindow: true},function(tabs) {
    chrome.tabs.sendMessage(tabs[0].id, {type: 'stop_selection', todo: 'delete'},function(response) {
      // response at je prvni odeslana akce selection
    });
  });

  // na bg
  chrome.runtime.sendMessage({state: 'recording_without_selecting', type: 'update_state'})

  // edit Html
  startBtn.style.display = 'block';
  saveBtn.remove()
  dontSaveBtn.remove()
  recordingHtml()
}

function startTraining(Parameters = true){
  if (Parameters){
    selecting_type = 'classifier_param';
  }
  else{
    selecting_type = 'classifier';
  }

  // edit html
  document.body.innerHTML = '<div id="some-div" class="div"></div>';
  let div = document.getElementById('some-div');

  // doc size
  // doc size
  document.documentElement.style.height = '140px';
  document.documentElement.style.width = '180px';
  document.body.style.height = '140px';
  document.body.style.height = '180px';

  // add label
  label = document.createElement('label');
  label.innerHTML = 'Start training!';
  label.classList.add('largelabel');
  label.style.margin = '60px 15px';
  div.appendChild(label);
  

  // na background
  // info o novem clf
  chrome.runtime.sendMessage({selecting: selecting_type, type: 'selecting_elements'}, (response) => {
    //console.log('response: ', response);
  });
  
  // do content scriptu
  chrome.tabs.query({active: true, currentWindow: true},function(tabs) {
    chrome.tabs.sendMessage(tabs[0].id, {selecting: selecting_type, type: 'selecting_elements'}, function(response) {
        //console.log(response);
    });
  }); 
  
  console.log('poslano zahajeni klasifikatoru')
}
