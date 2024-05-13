import xgboost as xgb
import pandas as pd
import numpy as np
import math
import copy
import json
import os

from transposition import Transposition
from classifier import Classifier
from example import Example

from utils import adjust_feature_names, fill_nans, prediction, remove_my_background_col

clf_list = []

class Document:
    def __init__(self, tabid, approved, move_to_next, elements, clfname, parameters):
        self.tabid = tabid
        self.approved = approved
        self.clfID = 0
        self.move_to_next = move_to_next
        self.elements = elements
        self.parameters = parameters
        self.raw_elements = copy.deepcopy(elements)
        self.docID = None
        self.selID = 0
        self.curr_pos = 0
        self.joined_example = None
        self.examples = []
        self.num_cols = None
        self.parent_cols = None
        self.all_suggested = {}
        self.id_transpositions = []
        self.IDs_to_replicate = []
        self.model = None
        self.clfname = None
        if clfname:
            self.clfname = clfname

    def find_doc_in_list(self, doc_list):
        old_doc = [doc for doc in reversed(doc_list) if doc.tabid == self.tabid][0]
        self.docID = copy.deepcopy(old_doc.docID)
        self.selID = copy.deepcopy(old_doc.selID)
        self.curr_pos = copy.deepcopy(old_doc.curr_pos)
        self.examples = copy.deepcopy(old_doc.examples)
        self.model = copy.deepcopy(old_doc.model)
        self.parameters = copy.deepcopy(old_doc.parameters)
        self.joined_example = copy.deepcopy(old_doc.joined_example)
        self.all_suggested = copy.deepcopy(old_doc.all_suggested)
        self.id_transpositions = copy.deepcopy(old_doc.id_transpositions)
        self.IDs_to_replicate = copy.deepcopy(old_doc.IDs_to_replicate)
        self.clfID = copy.deepcopy(old_doc.clfID)
        # clfID se hodi pro vlastni orientaci v IDlistu nez clf dostane konkretni jmeno

        if self.move_to_next:
            self.elements = copy.deepcopy(old_doc.raw_elements)
            self.raw_elements = copy.deepcopy(old_doc.raw_elements)
        doc_list.remove(old_doc)
        doc_list.append(self)

    def save_IDlist(self):
        from browser_automator import h_clfID, h_docID # replace with something sensible? why are there globals?
        print('clfID:', self.clfID)

        IDlist = {'clfID': self.clfID, 'docID': self.docID, 'selID': self.selID,
                  'approved': self.approved}
        h_IDlist = {'h_clfID': h_clfID, 'h_docID': h_docID}  # highest IDs
        print(h_IDlist)
        print('docID:', self.docID)
        with open("IDlist.json") as file:  # , "r"  je default
            loadedIDs = json.load(file)
        if IDlist not in loadedIDs:
            loadedIDs.append(IDlist)
        loadedIDs[0] = h_IDlist
        with open("IDlist.json", "w") as file:
            json.dump(loadedIDs, file, indent=2)

    def preprocess_received_data(self):
        all_attrs_keys = []  # vsechny vyskytujici se atributy
        for i in range(len(self.elements)):
            elem_attrs = (self.elements[i]['allAttributes'])
            elem_attrs_keys = list(elem_attrs)
            for key in elem_attrs_keys:
                if key not in all_attrs_keys and key != 'class':  # class je pozdeji v cssClass
                    all_attrs_keys.append(key)
        self.num_cols = []

        elem_style = (
            self.elements[0]['style'])  # style keys jsou vsude stejne, iterace jako vyse pres vsechno zbytecne dlouhe
        all_style_keys = list(elem_style)  # vsechny atributy stylu
        print('1.')
        # prirazeni hodnot atributu jednotlivym elementum
        longest_id = '0'
        i = 0
        while i < len(self.elements):
            element = self.elements[i]
            elem_attrs = element.pop('allAttributes', None)
            elem_style = element.pop('style', None)

            for key in all_attrs_keys:
                element[key] = elem_attrs.get(key, None)
            for key in all_style_keys:
                element[key] = elem_style.get(key, None)
            elem_id = element.get('data-masapi-id')
            if elem_id:
                if len(elem_id) > len(longest_id):
                    longest_id = elem_id
                i += 1
            else:
                self.elements.remove(element)  # mazu pripadne novy element bez id

        # classes pro jednotliva cisla z id
        id_classes_count = longest_id.count('-')
        print('2.')

        # jednotliva cisla z id
        for i in range(len(self.elements)):
            element = self.elements[i]
            elem_id = element.get('data-masapi-id')
            elem_par_ids = elem_id.split('-')

            for j in range(id_classes_count):
                key = 'parent_id ' + str(j)
                if j >= len(elem_par_ids):
                    element[key] = None
                else:
                    element[key] = elem_par_ids[j]

        self.parent_cols = []
        for i in range(id_classes_count):
            col_name = 'parent_id ' + str(i)
            self.parent_cols.append(col_name)
        self.parent_cols.pop(0)  # 'parent_id 0' smazano - obsahuje jen jednu hodnotu
        self.num_cols.append('childrenCount')
        self.num_cols.append('data-masapi-user-selection')
        self.num_cols = self.num_cols + self.parent_cols

    def create_DF_to_save_new_doc(self):
        docDF = pd.DataFrame(self.elements)
        docDF = docDF.drop(columns=['text'])
        docDF.pop('data-masapi-user-selection')
        return docDF

    def create_fake_user_selections(self):  # pro nepodminene
        user_count = 0
        user_selected = []
        selectedIDs = []
        selected_tagnames = []
        for i in range(len(self.elements)):
            element = self.elements[i]
            elem_id = element.get('data-masapi-id')
            if (element.get('data-masapi-user-selection') == 'true'):
                user_count += 1
                user_selected.append(element)
                selected_tagnames.append(element.get('tagname'))
                selectedIDs.append({'data-masapi-id': elem_id, 'data-masapi-user-selection': 1})
            elif (element.get('data-masapi-user-selection') == 'false'):
                user_count += 1  # pridane pri true -> user_count
                user_selected.append(element)
                selectedIDs.append({'data-masapi-id': elem_id, 'data-masapi-user-selection': 0})

        false_count = 0
        for i in range(len(self.elements)):
            element = self.elements[i]
            if (element.get('tagname') not in selected_tagnames):
                element['data-masapi-user-selection'] = 'false'
                false_count += 1
        print('user count:', user_count)
        print('false count:', false_count)

        while user_count <= (false_count / 100):  # nakopirovani oznacenych prikladu
            for elem in user_selected:
                self.elements.append(elem)
                user_count += 1
        return selectedIDs

    def create_DFs(self, selectedIDs = None):
        print('4. vytvareni dataframu')
        DF_elements = pd.DataFrame(self.elements)
        DF_elements = DF_elements.drop(
            columns=['text'])  # 'data-masapi-id' nechavam kvuli prip. dvou stejnym provkum - jeden pos a jeden neg?

        if selectedIDs:
            sel_DF = pd.DataFrame(selectedIDs)  # pro ukladani neapprovenuteho vyberu - nove
            sel_DF.loc[0, 'approved'] = False
        else:
            sel_DF = None

        neutral_rows = DF_elements.index[DF_elements['data-masapi-user-selection'] == 'neutral']
        neutral_rows = neutral_rows[::-1]

        print('5. encoding')
        X_le = DF_elements.copy()
        self.num_cols.append('data-masapi-id')

        dummy_cols = list(set(X_le.columns) - set(self.num_cols))

        X_le_dum = pd.get_dummies(data=X_le, columns=dummy_cols)

        X_le_dum = fill_nans(X_le_dum)

        X_le_dum = remove_my_background_col(X_le_dum)
        X_all = X_le_dum.copy()
        X_all = adjust_feature_names(X_all)

        return dummy_cols, X_le_dum, X_all, DF_elements, neutral_rows, sel_DF

    def save_new_doc_DF(self, docDF, dummy_cols):
        docDF_dum = pd.get_dummies(data=docDF, columns=dummy_cols)
        docDF_dum = fill_nans(docDF_dum)
        docDF_dum = remove_my_background_col(docDF_dum)
        docDF_dum = adjust_feature_names(docDF_dum)

        data_file_name = 'doc_' + str(self.docID) + '.csv'
        dir_path = './docs'
        data_path = os.path.join(dir_path, data_file_name)
        if not os.path.isdir(dir_path):  # pokud neexistuje directory
            os.mkdir(dir_path)
        docDF_dum.to_csv(data_path, index=False)

    def create_clf(self, X_le_dum, X_all, neutral_rows):
        print('6. mazani neutral radku')
        if self.selID == 0:
            X_le_dum.drop(neutral_rows, inplace=True)
            X_tr = X_le_dum  # u selID != 0 nezahazuju neutral_rows(nejsou)
            X_tr = adjust_feature_names(X_tr)
            X_tr = fill_nans(X_tr)

        else:  # selID != 0
            if self.move_to_next:  # pri kliknuti 'next' trenuju na predchozich examplech
                print('len-self.examples:', len(self.examples))
                X_tr = self.joined_example_to_training_df()
                self.IDs_to_replicate = []
                # promazu kliky z predchozich examplu

                # predchozi suggested k namnozeni v examplu
                for example in self.examples:
                    for elem_id in example.IDs:
                        if elem_id not in self.IDs_to_replicate:
                            self.IDs_to_replicate.append(elem_id)

                X_tr = self.replicate_clicked_elements(X_tr)
                X_tr = adjust_feature_names(X_tr)
                X_tr = fill_nans(X_tr)

            else:
                if neutral_rows.any():
                    X_le_dum.drop(neutral_rows, inplace=True)

                if self.curr_pos == 0:
                    # prvni klik - nejsou predchozi examply, funguje jako nepodm. vyber
                    X_tr = X_le_dum
                    X_tr = self.replicate_clicked_elements(X_tr)
                    X_tr = adjust_feature_names(X_tr)
                    X_tr = fill_nans(X_tr)

                else:  # opravne kliky u dalsich podminek- k prijatym datum s novymi user selection pripojim stare examply
                    X_ex = self.joined_example_to_training_df()  # , y_ex
                    X_tr = self.join_examples_and_new_click(X_ex, X_le_dum)
                    X_tr = self.replicate_clicked_elements(X_tr)
                    X_tr = adjust_feature_names(X_tr)
                    X_tr = fill_nans(X_tr)

            print('IDs_to_replicate:', self.IDs_to_replicate)

        X_tr = X_tr.drop(columns=['data-masapi-id'])
        X_all = X_all.drop(columns=['data-masapi-id'])

        y_tr = X_tr['data-masapi-user-selection'].copy()
        X_tr.pop('data-masapi-user-selection')
        X_all.pop('data-masapi-user-selection')

        # v nekterych pripadech je true/ false, nekde uz 0/1
        y_tr.loc[y_tr == 'true'] = 1
        y_tr.loc[y_tr == 'false'] = 0

        duplicate_columns = X_tr.columns[X_tr.columns.duplicated()]
        if len(duplicate_columns):
            print('duplicate_columns', duplicate_columns)

        print('7. fitovani modelu')
        model = xgb.XGBClassifier(tree_method="hist", enable_categorical=True)
        model.fit(X_tr, np.ravel(y_tr))
        self.model = model

        y_all = prediction(model, X_all)  # samo doplni sloupce na spravne misto

        clf = Classifier(self.clfID, model)  # musi byt? nebo jen nacitani ze souboru
        clf_list.append(clf)
        # print(clf_list[received_doc.clfID].model)

        return y_all

    def join_examples_and_new_click(self, X_ex, X_le_dum):
        # oboje prepocitano s novym posunem uz ve zpracovani elementu
        joined = pd.concat([X_ex, X_le_dum])  # .drop_duplicates()
        joined = fill_nans(joined)
        joined = joined.drop_duplicates(ignore_index=True)

        X_tr = joined.copy()  # s copy() ?
        return X_tr

    def join_all_examples(self):  # po prepocitavani examplu s novymi posuny
        new_joined = []
        for example in self.examples:
            new_joined = new_joined + [x for x in example.elements if x not in new_joined]
            print('len new_joined', len(new_joined))

        self.joined_example = new_joined

    def update_joined_example(self):  # pripojeni noveho po move_to_next
        if len(self.examples) > 1:  # ukladam po kazdem suggested = i "nepotvrzene" mezivybery
            # pripadnou novou transpozici dopocitavam vsem examplum hned po kliknuti
            new_example = self.examples[self.curr_pos - 1].elements

            joined_example = self.joined_example + [x for x in new_example if x not in self.joined_example]
            self.joined_example = joined_example

        else:  # po prvnim kliku na next nespojuju zadne examply
            # ale dopocitavam featury pro posuny, pokud mam vybrano vice elementu
            example = self.examples[self.curr_pos - 1]  # = suggested z predchoziho vyberu
            print('self.examples len:', len(self.examples))
            if example.multiple:  # vice elems v podm. vyberu
                # TODO - zalezi, jestli je multiple?
                # vypocet jednotlivych posunu
                for positive_elem in example.IDs:  # v IDs ulozeny suggested
                    curr_cond_id_parts = example.curr_cond_elem_id.split('-')
                    selected_id_parts = positive_elem.split('-')
                    new_transp = self.is_new_transposition(curr_cond_id_parts, selected_id_parts)
                    # nove transpozice se pridaji do self.id_transpositions

                # 2. moznost
                for transp in self.id_transpositions:
                    self.is_moved_to_selected(example.elements, transp, example.curr_cond_elem_id)
                    transp_feature_name = transp.create_feature_name()
                    self.num_cols.append(transp_feature_name)

            self.joined_example = example.elements

    def joined_example_to_training_df(self):
        example_DF = pd.DataFrame(self.joined_example)  # novy posun uz mam prepocitan a joined_example aktualizovan
        example_DF = example_DF.drop(columns=['text'])  # , 'data-masapi-id' - ted mazu az v create_clf

        example_id_path_cols = [col for col in example_DF if col.startswith('id_path')]

        # pridat prvne odstraneni starych id_paths, ... ?
        self.num_cols = list(set(self.num_cols + example_id_path_cols))
        dummy_cols = list(set(example_DF.columns) - set(self.num_cols))

        X_le_dum = pd.get_dummies(data=example_DF, columns=dummy_cols)

        X_le_dum = remove_my_background_col(X_le_dum)

        X_tr = X_le_dum

        return X_tr

    def get_id_appendix(self, elem_id_parts, curr_cond_id_parts):
        elem_appdx = None
        cond_appdx = None

        if len(elem_id_parts) > len(curr_cond_id_parts):
            len_diff = len(elem_id_parts) - len(curr_cond_id_parts)
            elem_appdx = elem_id_parts[-len_diff:]
            elem_appdx = [eval(i) for i in elem_appdx] # strings -> ints
        elif len(curr_cond_id_parts) > len(elem_id_parts):
            len_diff = len(curr_cond_id_parts) - len(elem_id_parts)
            cond_appdx = curr_cond_id_parts[-len_diff:]
            cond_appdx = [eval(i) for i in cond_appdx] # strings -> ints
        else:  # len == len
            pass
        return elem_appdx, cond_appdx

    def create_example(self, suggested):  # self, X_all, y_all
        # v elements mam po kliknuti next nastavene neutral user-selections
        example = Example(self.all_suggested[self.selID - 1][self.curr_pos], copy.deepcopy(self.elements), suggested)
        for i in range(len(example.elements)):
            element = example.elements[i]
            elem_id = element.get('data-masapi-id')
            if (elem_id in suggested):
                element['data-masapi-user-selection'] = 1
            else:
                element['data-masapi-user-selection'] = 0
        if len(suggested) > 1:
            example.multiple = True
        self.save_example(example)

    def save_example(self, example):
        if len(self.examples) > self.curr_pos:
            self.examples[self.curr_pos] = example
        else:
            self.examples.insert(self.curr_pos, example)

    def save_clf_model(self):
        print('8. ukladani dat')
        clf_file_name = str(self.clfname) + '.json'
        dir_path = './clfs'
        data_path = os.path.join(dir_path, clf_file_name)
        if not os.path.isdir(dir_path):  # pokud neexistuje directory
            os.mkdir(dir_path)
        self.model.save_model(data_path)

        sugg_file_name = str(self.clfname) + '.json'
        dir_path = './suggested'
        file_path = os.path.join(dir_path, sugg_file_name)
        os.rename('./suggested/None.json', file_path)

    def save_user_selection(self, sel_DF):
        data_file_name = 'sel_' + str(self.docID) + '_' + str(
            self.selID) + '.csv'
        dir_path = './selections'
        data_path = os.path.join(dir_path, data_file_name)
        if not os.path.isdir(dir_path):  # pokud neexistuje directory
            os.mkdir(dir_path)
        sel_DF.to_csv(data_path, index=False)
        sel_DF.to_csv(data_path, index=False)

    def get_suggested_elements(self, y_all, X):
        suggested = []
        for i in range(len(y_all)):
            if y_all[i] == 1:
                if X['data-masapi-id'][i] not in suggested:
                    suggested.append(X['data-masapi-id'][i])
        self.all_suggested[self.selID] = suggested  # TODO - dodelat i s curr_pos - kvuli podm. vyb.
        if self.selID != 0:
            self.create_example(suggested)

        sugg_file_name = str(self.clfname) + '.json'
        dir_path = './suggested'
        file_path = os.path.join(dir_path, sugg_file_name)
        if not os.path.isdir(dir_path):  # pokud neexistuje directory
            os.mkdir(dir_path)

        # ulozi do None.json -> zmena jmena pozdeji s clf
        with open(file_path, 'w') as f:
            f.write(json.dumps(suggested))

        print('all_suggested', self.all_suggested)
        return suggested

    # method for selID !=0:
    def get_user_selected_elems(self):
        user_selected = []
        selectedIDs = []
        user_count = 0
        selected_tagnames = []

        if not self.move_to_next:  # kdyz klikam
            for i in range(len(self.elements)):
                element = self.elements[i]
                elem_id = element.get('data-masapi-id')
                if (element.get('data-masapi-user-selection') == 'true'):
                    element['data-masapi-user-selection'] = 1
                    user_count += 1
                    user_selected.append(element)
                    selected_tagnames.append(element.get('tagname'))
                    selectedIDs.append({'data-masapi-id': elem_id, 'data-masapi-user-selection': 1})
                    if elem_id not in self.IDs_to_replicate:
                        self.IDs_to_replicate.append(elem_id)
                elif (element.get('data-masapi-user-selection') == 'false'):
                    element['data-masapi-user-selection'] = 0
                    user_count += 1
                    user_selected.append(element)
                    selectedIDs.append({'data-masapi-id': elem_id, 'data-masapi-user-selection': 0})
                    if elem_id not in self.IDs_to_replicate:
                        self.IDs_to_replicate.append(elem_id)
                else:  # neutral
                    pass  # zatim nechavam 'neutral'
            for i in range(len(self.elements)):  # zpracovavam neutrals
                element = self.elements[i]
                if user_count == 1 & self.curr_pos == 0:
                    # pri prvnim kliku u prvni podminky nechavam True jeden elem, ostatni nastavim False
                    # predpokladam vyber jednoho elementu
                    if (element.get('data-masapi-user-selection') != 1):  # 0 nebo Neutral
                        element['data-masapi-user-selection'] = 0
                else:
                    # pri vice kliknutich nechavam i Neutral - predpokladam vyber vice elems pri jedne podmince
                    # nastavuji navic False u jinych tagnames
                    if (element.get('tagname') not in selected_tagnames):
                        element['data-masapi-user-selection'] = 0

        elif self.move_to_next:  # neposilam si nove elementy -> mazu predchozi vyber
            # TODO - mozne odstranit?
            for i in range(len(self.elements)):
                self.elements[i]['data-masapi-user-selection'] = 0
                self.raw_elements[i]['data-masapi-user-selection'] = 0

        print('len user_selected: ', len(user_selected))
        return user_selected, selectedIDs, user_count

    def add_conditional_sel_attrs(self, user_selected, user_count): # FOR TRAINING
        new_transp = False
        if self.move_to_next:
            self.curr_pos += 1  # presun

        print('curr_pos:', self.curr_pos)
        curr_condition_id = self.all_suggested[self.selID - 1][self.curr_pos]  # aktualni podminka
        print('move_to_next:', self.move_to_next)

        if not self.move_to_next:
            for elem in user_selected:  # kontrola, jestli novy posun
                selected_id = elem.get('data-masapi-id')  # TODO - dodelat pro vice elementu
                selected_id_parts = selected_id.split('-')
                curr_cond_id_parts = curr_condition_id.split('-')
                if elem.get('data-masapi-user-selection') == 1:
                    new_transp = self.is_new_transposition(curr_cond_id_parts, selected_id_parts)

            if new_transp == True and len(self.examples) > 1:  # opravne kliky od druhe podminky
                transp = self.id_transpositions[-1]
                for example in self.examples:
                    self.is_moved_to_selected(example.elements, transp, example.curr_cond_elem_id)
                self.join_all_examples()
        elif self.move_to_next:
            self.update_joined_example()  # musim updatnout uz tady -> ziskam transps do id_transpositions

        for transp in self.id_transpositions:
            # prepocet posunu vuci aktualni podmince
            # i pro move_to_next - data pro inferenci
            self.is_moved_to_selected(self.elements, transp, curr_condition_id)
            ### nechat?
            # pridane
            self.is_moved_to_selected(user_selected, transp, curr_condition_id)
            transp_feature_name = transp.create_feature_name()
            self.num_cols.append(transp_feature_name)

        id_path_cols = self.create_id_path_cols()  # je k necemu? jinak dohledavam podle startswith
        # id_path_cols.pop(0)  # 'parent_id 0' je smazano - obsahuje jen jednu hodnotu # ?? zmenit po zmene s tr_idx
        self.num_cols = self.num_cols + id_path_cols

        if not self.move_to_next:  # pro move_to_next user_selected nejsou
            # pro funkčnost jednoprvkových podmíněných
            while user_count <= (len(self.elements) / 100):  # nakopirovani oznacenych prikladu - True i False
                for elem in user_selected:
                    self.elements.append(elem)
                    user_count += 1

        print('user_count', user_count)
        return id_path_cols
    
    def compute_condition_attributes(self, condition_id, model):  # FOR INFERENCE
        clf_features = model.get_booster().feature_names
        transpositions = [transp for transp in clf_features if transp.startswith('transposition_')]

        for tr in transpositions:
            transp_split = tr.split('#')
            id_transp = transp_split[0].split('_')[1].split(';')
            id_transp = [eval(i) for i in id_transp] # strings -> ints
            transp = Transposition(id_transp, None, None)

            if transp_split[1]:
                sel_appdx = transp_split[1].split(';')
                sel_appdx = [eval(i) for i in sel_appdx]
                transp.sel_appdx = sel_appdx

            if transp_split[2]:
                cond_appdx = transp_split[2].split(';')
                cond_appdx = [eval(i) for i in cond_appdx]
                transp.cond_appdx = cond_appdx

            # prepocet posunu vuci aktualni podmince
            self.is_moved_to_selected(self.elements, transp, condition_id)
            ### nechat?
            # pridane
            transp_feature_name = transp.create_feature_name()
            self.num_cols.append(transp_feature_name)

        id_path_cols = self.create_id_path_cols()  # je k necemu? jinak dohledavam podle startswith
        # id_path_cols.pop(0)  # 'parent_id 0' je smazano - obsahuje jen jednu hodnotu # ?? zmenit po zmene s tr_idx
        self.num_cols = self.num_cols + id_path_cols


    def create_id_path_cols(self):
        id_path_cols = []
        for transp in self.id_transpositions:
            for i in range(len(transp.curr_cond_id_parts)):
                transp_feature_name = transp.create_feature_name()
                col_name = 'id_path_' + str(i) + '_' + transp_feature_name
                id_path_cols.append(col_name)
        return id_path_cols

    def is_new_transposition(self, curr_cond_id_parts, selected_id_parts):
        # vypocet posunu
        id_diff_parts = []
        i = 0
        while (i < len(curr_cond_id_parts) and i < len(selected_id_parts)):
            id_diff_parts.append(int(curr_cond_id_parts[i]) - int(selected_id_parts[i]))
            i += 1

        # vypocet appendixu
        sel_appdx = None
        cond_appdx = None
        if len(selected_id_parts) > len(curr_cond_id_parts):
            len_diff = len(selected_id_parts) - len(curr_cond_id_parts)
            sel_appdx = selected_id_parts[-len_diff:]
        elif len(curr_cond_id_parts) > len(selected_id_parts):
            len_diff = len(curr_cond_id_parts) - len(selected_id_parts)
            cond_appdx = curr_cond_id_parts[-len_diff:]
        else:  # len == len
            pass
        
        # vytvoreni transpozice
        transposition = Transposition(id_diff_parts, selected_id_parts, curr_cond_id_parts)
        if sel_appdx:
            transposition.sel_appdx = sel_appdx
        if cond_appdx:
            transposition.cond_appdx = cond_appdx

        # jestli je posun novy
        i = 0
        while i < len(self.id_transpositions):
            if transposition.id_transp == self.id_transpositions[i].id_transp \
                    and transposition.sel_appdx == self.id_transpositions[i].sel_appdx \
                    and transposition.cond_appdx == self.id_transpositions[i].cond_appdx:
                new_transp = False
                break
            i += 1
        else:
            new_transp = True
            self.id_transpositions.append(transposition)

        return new_transp

    def is_moved_to_selected(self, elements, transposition, curr_condition_id):
        curr_cond_id_parts = curr_condition_id.split('-')

        for i in range(len(elements)):
            element = elements[i]
            elem_id = element.get('data-masapi-id')
            elem_id_parts = elem_id.split('-')
            elem_appdx, cond_appdx = self.get_id_appendix(elem_id_parts, curr_cond_id_parts)
            moved_id_parts = elem_id_parts
            appdx_check = True

            # pocitani jestli posun do vybraneho
            j = 0
            while j < len(moved_id_parts) and j < len(transposition.id_transp):
                moved_id_parts[j] = (int(moved_id_parts[j]) + int(transposition.id_transp[j]))
                j += 1

            if transposition.sel_appdx:  # elem je delsi nez podminka
                if elem_appdx == transposition.sel_appdx:
                    appdx_check = True
                    moved_id_parts = moved_id_parts[:-len(elem_appdx)]
                else:
                    appdx_check = False
            elif transposition.cond_appdx:  # podminka je delsi
                for k in transposition.cond_appdx:
                    moved_id_parts.append(int(k))
            else:
                pass

            moved_id = '-'.join(str(i) for i in moved_id_parts)

            transp_feature_name = transposition.create_feature_name()

            if moved_id == curr_condition_id and appdx_check == True:
                element[transp_feature_name] = '1'

                if len(self.examples) == 1 and self.move_to_next and elements == self.examples[
                    self.curr_pos - 1].elements:
                    # TODO - zhorsuje pri jednoprvkovem vyberu - po zmene pocitani transpozic uz mozna ne
                    # pridani falesne negativnich prikladu do prvniho examplu
                    # -> zvyseni relevance moved_to_sel featur oproti ostatnim
                    copied_elem = copy.deepcopy(element)
                    copied_elem[transp_feature_name] = '0'
                    copied_elem['data-masapi-user-selection'] = 0
                    if copied_elem not in elements:
                        elements.append(copied_elem)

                        print('zkopirovano')
                        print(transp_feature_name)
                        print(copied_elem['data-masapi-id'])

            else:
                element[transp_feature_name] = '0'

            # casti rozdilu vybraneho a elementu
            j = 0
            while j < len(elem_id_parts) and j < len(curr_cond_id_parts):  # pokud je elem_id_parts kratsi nez curr_cond
                key = 'id_path_' + str(j) + '_' + transp_feature_name
                element[key] = int(curr_cond_id_parts[j]) - int(elem_id_parts[j])
                j += 1
            while j < len(
                    curr_cond_id_parts):  # zbytek doplnuju -1, appendix zahazuju, at nemam promenne delky = pocet featur
                key = 'id_path_' + str(j) + '_' + transp_feature_name
                element[key] = -1
                j += 1

    def replicate_clicked_elements(self, df):
        df = df.drop_duplicates(ignore_index=True)
        rows_to_replicate = df.loc[df['data-masapi-id'].isin(
            self.IDs_to_replicate)]  # vybere vsechny radky s 1 IDckem - zbytek radku muze byt ruzny - ruzne user_selection
        print('IDs_to_replicate', self.IDs_to_replicate)

        replicate_count = math.ceil(len(df) / 100 / len(rows_to_replicate)) # pocet elementu/100 je random nastavene
        print('replicate_count', replicate_count)
        print('len(rows)', len(rows_to_replicate))
        print('len(df)', len(df))
        replicated_rows = pd.DataFrame(np.repeat(rows_to_replicate.values, replicate_count, axis=0),
                                       columns=rows_to_replicate.columns)
        print('rep_rows user selection̈́', replicated_rows['data-masapi-user-selection'].value_counts())
        new_df = pd.concat([df, replicated_rows])
        return new_df