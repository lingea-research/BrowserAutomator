import json
import os
import copy

import pandas as pd
import os.path
from flask import Flask, request, make_response
from flask_cors import CORS

from replay import Replay

from utils import load_clf_model, prediction, process_rec_action, process_rec_approval, process_received_msg_content, start_new_recording, start_new_selection
from document import Document

# flask
app = Flask(__name__)
CORS(app) # to be accessible from browser (MASAPI GUI)

# loading IDs -> get highest IDs
if os.path.exists('IDlist.json'):
    loadedIDs = json.load(open('IDlist.json'))
else:
    loadedIDs = [{'h_clfID': 0, 'h_docID': 0}, {'clfID': 0, 'docID': 0, 'selID': 0, 'approved': False}]
    with open('IDlist.json', 'w') as file:
        json.dump(loadedIDs, file, indent=2)

h_clfID = loadedIDs[0].get('h_clfID')  # ulozeny nejvyssi hodnoty
h_docID = loadedIDs[0].get('h_docID')
replay = None

@app.route('/automator/', methods=['POST'])
def receive_data():
    global h_clfID, h_docID, replay
    # TODO: pridat vytvoreni directories pri spuseni -> nemusi byt dale vsude mozne

    if request.method == 'POST':
        print('0. data received')

        # decode multipart form data?
        received_dict = dict(request.form)

        message_type = json.loads(received_dict['type'])
        message_content = json.loads(received_dict['content'])
        print('message_type:', message_type)

        if message_type == 'new_recording':
            start_new_recording(message_content)
            message_to_send = {'type': message_type, 'content': ''}

        elif message_type == 'action':
            process_rec_action(message_content)
            message_to_send = {'type': message_type, 'content': ''}

        elif message_type == 'recording_approval':
            process_rec_approval(message_content)
            message_to_send = {'type': message_type, 'content': ''}

        elif message_type == 'get_saved_files':
            file_type = message_content['file_type']

            dir_path = './' + file_type

            all_names = [os.path.splitext(filename)[0] for filename in os.listdir(dir_path)]  # odstraneni .json

            # / os.walk('dir_path'):  =recursively get the list all files in directory and subdirectories
            message_to_send = {'type': message_type, 'content': {'file_type': file_type, 'file_list': all_names}}
        
        elif message_type == 'get_replay_status':
            # UNUSED

            # TODO: zmena pro vice replayu?
            status = None
            if replay is not None:
                status = replay.already_replayed

            message_to_send = {'type': message_type, 'content': status}
        

        elif message_type == 'delete_file':
            # UNUSED

            file_type = message_content['file_type']
            file_name = str(message_content['file_name']) 
            
            if file_type == 'recording':
                dir_path = './recordings'
                file_name = file_name + '.json'
                file_path = os.path.join(dir_path, file_name)

            elif file_type == 'classifier':
                dir_path = './clfs'
                file_name = file_name + '.json'
                file_path = os.path.join(dir_path, file_name)

            elif file_type == 'dataset':
                dir_path = './datasets'
                file_name = file_name + '.csv'
                file_path = os.path.join(dir_path, file_name)

            if os.path.exists(file_path):
                os.remove(file_path)

            message_to_send = {'type': message_type, 'content': ''}

        elif message_type == 'send_recording_json':
            # UNUSED

            # from GUI

            recording_path = './recordings/' + str(message_content['chosenScn']) + '.json'

            # load recording
            with open(recording_path, 'r') as f:
                recording_json = json.load(f)

            message_to_send = {'type': message_type, 'content': recording_json}

        elif message_type == 'replay_this_json':
            # from GUI


            startingURL = message_content['starting_URL']
            scenario = json.loads(message_content['scenario'])

            replay = Replay(startingURL, scenario)

            # create new driver and replay
            replay.create_driver()
            replay.replay_scenario()

            message_to_send = {'type': message_type, 'content': ''}

        elif message_type == 'replay_from_extension':
            # recording in driver

            # TODO: dodelat headless z extensiony

            startingURL = message_content['starting_URL']
            recording_path = './recordings/' + str(message_content['chosenScn']) + '.json'

            # load recording
            with open(recording_path, 'r') as f:
                scenario = json.load(f)

            replay = Replay(startingURL, scenario)

            # create new driver and replay
            replay.create_driver()
            replay.replay_scenario()

            message_to_send = {'type': message_type, 'content': ''}

        elif message_type == 'new_classifier':
            h_docID, h_clfID = start_new_selection(message_content, h_docID, h_clfID)

            message_to_send = {'type': message_type, 'content': ''}

        elif message_type == 'elements_to_classify':
            # vytvarim novy clf
            received_doc, loadedIDs, IDlist, h_docID, h_clfID = process_received_msg_content(message_content, h_docID, h_clfID)
            
            received_doc.save_IDlist()
            print('approved', received_doc.approved)
            received_doc.preprocess_received_data()

            print('3.')
            print('selID:', received_doc.selID)
            if os.path.exists('docs/doc_'+str(received_doc.docID)+'.csv'):
                newdocDF = None
            else:
                # csv neexistuje = novy dokument -> ulozim
                newdocDF = received_doc.create_DF_to_save_new_doc() # newdocDF puvodne docDF

            if received_doc.selID != 0:  # podminene vybery
                # TODO: - dodelat pro vice vyberu
                user_selected, selectedIDs, user_count = received_doc.get_user_selected_elems()
                id_path_cols = received_doc.add_conditional_sel_attrs(user_selected, user_count)
                dummy_cols, X_le_dum, X_all, X, neutral_rows, sel_DF = received_doc.create_DFs(selectedIDs)
                y_all = received_doc.create_clf(X_le_dum, X_all, neutral_rows)

            elif received_doc.selID == 0:
                selectedIDs = received_doc.create_fake_user_selections()
                dummy_cols, X_le_dum, X_all, X, neutral_rows, sel_DF = received_doc.create_DFs(selectedIDs)
                if newdocDF is not None:
                    received_doc.save_new_doc_DF(newdocDF, dummy_cols)

                y_all = received_doc.create_clf(X_le_dum, X_all, neutral_rows)

                received_doc.save_user_selection(sel_DF)

            suggested = received_doc.get_suggested_elements(y_all, X)

            # odeslani dat
            message_to_send = {'type': 'suggested_elems', 'content': suggested}
            print('message_to_send', message_to_send)

        elif message_type == 'load_classifier_elems':
            # TODO: prejmenovat
            elements = message_content['elements']
            classifier = message_content['classifier']

            # process to dataframes, ...
            DOM = Document(None, None, None, elements, classifier, None)
            DOM.preprocess_received_data()

            # load classifier
            model = load_clf_model(classifier)

            _, _, X_all, X, _, _ = DOM.create_DFs()

            # classify
            y_all = prediction(model, X_all)
            print(y_all)
            suggested = DOM.get_suggested_elements(y_all, X)

            # odeslani dat
            message_to_send = {'type': 'loaded_clf_elems', 'content': suggested}
            print('message_to_send', message_to_send)

        elif message_type == 'classifier_finished':
            # TODO: smazat examply a pod, kvuli dalsimu klasifikatoru v jednom recordingu?
            received_doc, loadedIDs, IDlist, h_docID, h_clfID = process_received_msg_content(message_content, h_docID, h_clfID)
            
            #if received_doc.elements:  # elements nejsou prazdne - kontrola jestli byl odeslan nejaky klik - neulozim vyber uzivatelem 'approvenuty' hned po spusteni
            if received_doc.approved == True:  # nemusi byt true pokud dam v pop-upu 'End without saving'
                print('received_doc.approved == True')
                sugg_DF = pd.DataFrame()
                sugg_DF['data-masapi-id'] = received_doc.all_suggested[received_doc.selID]
                sugg_DF['data-masapi-user-selection'] = 1
                sugg_DF.loc[0, 'approved'] = received_doc.approved

                received_doc.save_clf_model()

                data_file_name = 'sel_' + str(received_doc.docID) + '_' + str(
                    received_doc.selID) + '.csv'  # IDlist.get('docID') , IDlist.get('selID')
                dir_path = './selections'
                data_path = os.path.join(dir_path, data_file_name)
                if not os.path.isdir(dir_path):  # pokud neexistuje directory - vytvorim
                    os.mkdir(dir_path)
                sugg_DF.to_csv(data_path, index=False)

                # save IDlist
                old_IDlist = copy.deepcopy(IDlist)
                old_IDlist['approved'] = False

                print('IDlist', IDlist)
                print('old_IDlist', old_IDlist)
                print('approved', received_doc.approved)
                loadedIDs.remove(old_IDlist)
                loadedIDs.append(IDlist)
                with open("IDlist.json", "w") as file:
                    json.dump(loadedIDs, file, indent=2)

            # TODO: asi muzu promazat ? - hlavne by se muselo prepsat v doc_listu?
            # puvodne kvuli navazanym vyberum - approvnuti a pokracovani na jednom docu
            received_doc.id_transpositions = []
            #received_doc.selID += 1
            received_doc.curr_pos = 0

            # odeslani dat
            message_to_send = {'type': message_type, 'content': ''}


        send_data = json.dumps(message_to_send)
        resp = make_response(send_data)
        resp.headers['Access-Control-Allow-Origin'] = '*'
        resp.headers['Content-Type'] = 'multipart/form-data'
        return resp


def create_folder(name: str) -> None:
    if not os.path.isdir(name):
        os.mkdir(name)


if __name__ == "__main__":
    create_folder('clfs')
    create_folder('datasets')
    create_folder('docs')
    create_folder('recordings')
    create_folder('selections')
    create_folder('suggested')

    app.run(host="0.0.0.0", port=8881, debug=True)
