import xgboost as xgb
import pandas as pd

import os
import re
import json

from recording import Recording
from action import Action

documents_list = []  # TODO - dodelat ukladani / tahani ze souboru
recordings_list = []  # TODO - dodelat ukladani / tahani ze souboru

def remove_my_background_col(df):
    if 'style_background-color: rgb(255, 155, 155);' in df:
        df = df.drop(columns=['style_background-color: rgb(255, 155, 155);'])
    return df


def fill_nans(df):
    not_zero_cols = ([col for col in df if col.startswith(('parent_id', 'id_path'))])
    if not_zero_cols:
        df[not_zero_cols] = df[not_zero_cols].fillna(-1)
        df[not_zero_cols] = df[not_zero_cols].astype(int)
    df = df.fillna(0)

    transposition_cols = [col for col in df if col.startswith('transposition_')]
    if transposition_cols:
        df[transposition_cols] = df[transposition_cols].astype(int)
    return df


def prediction(model, X_all):
    clf_features = model.get_booster().feature_names
    X_clf = pd.DataFrame(X_all, columns=clf_features)
    par_clf_cols = [col for col in X_clf if col.startswith('parent_id')]  # parenty vyplnuju s -1, ostatni s 0
    X_clf[par_clf_cols] = X_clf[par_clf_cols].fillna(-1)
    X_clf = X_clf.fillna(0)
    # print(clf_features)
    y_all = model.predict(X_clf)
    return y_all


def adjust_feature_names(df):
    regex = re.compile(r'[\[\]<]', re.IGNORECASE)  # "\[|\]|<"
    df.columns = [regex.sub("_", col) if any(x in str(col) for x in {'[', ']', '<'}) else col for col in
                  df.columns.values]
    return df


def start_new_recording(message_content):
    recording = Recording(message_content['tabid'], message_content['recid'],
                         message_content['recording'], message_content['startingURL'],
                         message_content['windowHeight'], message_content['windowWidth'],
                         message_content['zoom'], message_content['approval'])
    recordings_list.append(recording)


def process_rec_action(message_content):
    recording = Recording(message_content['tabid'], message_content['recid'],
                          message_content['recording'], message_content['startingURL'],
                          message_content['windowHeight'], message_content['windowWidth'],
                          message_content['zoom'], message_content['approval'])

    new_action = Action()
    new_action.set_attributes(message_content['action'])

    # TODO: uz smazat?
    if 'dataset' in message_content['action']:
        new_action.dataset = message_content['action']['dataset']

    recording.new_action = new_action
    
    recording.find_rec_in_list(recordings_list)


def process_rec_approval(message_content):
    recording = Recording(message_content['tabid'], message_content['recid'],
                         message_content['recording'], message_content['startingURL'],
                         message_content['windowHeight'], message_content['windowWidth'],
                         message_content['zoom'], message_content['approval'])

    recording.scnName = message_content['scnName']

    recording.find_rec_in_list(recordings_list)

    if recording.approval:
        create_browser_closing_action(recording)
        recording.save_recording()

    # TODO: dodelat odmazavani z listu? napr. vsechny stejne taby pri new_recordingu

def create_browser_closing_action(recording):
    close_browser_action = Action()
    close_browser_action.action = "close_browser"
    recording.actions.append(close_browser_action)

def start_new_selection(message_content, h_docID, h_clfID):
    from document import Document
    received_doc = Document(message_content['tabid'], message_content['approval'],
                            message_content['next'], message_content['elements'],
                            message_content['clfName'], message_content['parameters'])

    # set docID, clfID
    received_doc.docID = h_docID + 1
    received_doc.clfID = h_clfID + 1
    h_docID = received_doc.docID
    h_clfID = received_doc.clfID

    received_doc.selID = 0
    received_doc.curr_pos = 0

    if received_doc.parameters:
        print('PARAMETERS:', received_doc.parameters)
        
        # TODO: jen workaround pro jeden podmineny
        received_doc.all_suggested[received_doc.selID] = received_doc.parameters
        received_doc.selID = 1
    else:
        pass
        # nejsou zadany parametry
        # TODO

    documents_list.append(received_doc)

    return h_docID, h_clfID

def load_clf_model(clfname):
    print('8. nacitani clf')
    # TODO: predelat clfID na clfName
    # load clfID model
    clf_file_name = str(clfname) + '.json'
    clf_path = os.path.join('./clfs', clf_file_name)
    model = xgb.XGBClassifier()
    model.load_model(clf_path)
    return model

def process_received_msg_content(message_content, h_docID, h_clfID):
    from document import Document
    received_doc = Document(message_content['tabid'], message_content['approval'],
                            message_content['next'], message_content['elements'],
                            message_content['clfName'], message_content['parameters'])

    print('received_doc.clfName: ', received_doc.clfname)

    received_doc.find_doc_in_list(documents_list)  # elementy pouzity nove

    # puvodne jen v selection_approval
    print('docID: ', received_doc.docID)
    print('selID: ', received_doc.selID)
    IDlist = {'clfID': received_doc.clfID, 'docID': received_doc.docID, 'selID': received_doc.selID,
              'approved': received_doc.approved}

    with open("IDlist.json") as file:  # , "r"  je default
        loadedIDs = json.load(file)  # TODO - jinak nez lastIDs

    return received_doc, loadedIDs, IDlist, h_docID, h_clfID
