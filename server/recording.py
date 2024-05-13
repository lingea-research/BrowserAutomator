import copy
import json
import os

from action import Action

class Recording:
    def __init__(self, tabid, recid, recording, startingURL, windowHeight, windowWidth, zoom, approval):
        self.tabid = tabid
        self.recid = recid
        self.recording = recording
        self.startingURL = startingURL
        self.windowHeight = windowHeight
        self.windowWidth = windowWidth
        self.zoom = zoom
        self.approval = approval
        self.new_action = None
        self.actions = []
        self.scnName = None

    def find_rec_in_list(self, rec_list):
        old_rec = [rec for rec in reversed(rec_list) if rec.recid == self.recid][0]
        self.startingURL = copy.deepcopy(old_rec.startingURL)
        self.actions = copy.deepcopy(old_rec.actions)

        # TODO: new action vytahnout ven zvlast do fce pro prehlednost
        if self.new_action:
            self.actions.append(self.new_action)

        self.removeUselessActions()

        rec_list.remove(old_rec)
        rec_list.append(self)

    def removeUselessActions(self):
        # prubezne mazani nadbytecnych akci 

        self.countContinuousKeyDownActions()
        self.removeKeyActionsBetweenTextInsertions()
        self.removeClicksBetweenTextInsertions()
        self.removeContinuousTextInsertion()

    def removeKeyActionsBetweenTextInsertions(self):
        actions_list = self.actions
        # 1. keydown - insert_text - keyup
        # nechavam jen insert_text
        if len(actions_list) > 3:
            if (actions_list[-3].action == 'keydown'\
                and actions_list[-2].action == 'insert_text'\
                and actions_list[-1].action == 'keyup')\
                and actions_list[-3].element == actions_list[-2].element == actions_list[-1].element\
                and actions_list[-3].key == actions_list[-1].key:

                actions_list.remove(actions_list[-3])
                actions_list.remove(actions_list[-1])

        # 2. keydown - insert_text - keydown - insert_text - keydown - insert_text - keyup
        # kontroluju keydown - insert_text - keydown - insert_text 
        # odmazavam nejstarsi keydown - insert_text
        # nakonec zbyde keydown - insert_text - keyup -> (prip. 1) nechavam jen insert_text
        if len(actions_list) > 4:
            if (actions_list[-4].action == 'keydown'\
                and actions_list[-3].action == 'insert_text'\
                and actions_list[-2].action == 'keydown'\
                and actions_list[-1].action == 'insert_text')\
                and actions_list[-4].element == actions_list[-3].element\
                    == actions_list[-2].element == actions_list[-1].element\
                and actions_list[-4].key == actions_list[-2].key:

                actions_list.remove(actions_list[-4])
                actions_list.remove(actions_list[-3])

        # 3. mackani specialnich klaves (Shift, Backspace, ..) behem uprav textu se vyresi
        # behem 1. a 2., kombinace vice klaves (napr ctrl, shift, sipky pro pesun textu)
        # bude vyresen az pri ukladani scenare - smaze se vsechno v jednom elementu
        # mezi dvema insert_text akcemi

    def countContinuousKeyDownActions(self):
        actions_list = self.actions
        # dve stejne keydown akce sobe
        if len(actions_list) > 2 \
            and (actions_list[-2].action == 'keydown'\
            and actions_list[-1].action == 'keydown')\
            and (actions_list[-2].key == actions_list[-1].key):

            action_count = actions_list[-2].count
            action_count += 1
            actions_list[-1].count = action_count
            actions_list.remove(actions_list[-2])

    def removeContinuousTextInsertion(self):
        # dve zmeny textu ve stejnem elementu po sobe
        actions_list = self.actions
        if len(actions_list) > 2 \
            and (actions_list[-2].action == 'insert_text'\
                 and actions_list[-1].action == 'insert_text')\
            and (actions_list[-2].element == actions_list[-1].element):

            actions_list.remove(actions_list[-2])

    def removeClicksBetweenTextInsertions(self):
        # klik na stejny elem mezi dvema zmenami textu
        # -> predpokladam klik v ramci upravy textu
        actions_list = self.actions
        if len(actions_list) > 3:
            if (actions_list[-3].action == 'insert_text'\
                and actions_list[-2].action == 'click'\
                and actions_list[-1].action == 'insert_text')\
                and actions_list[-3].element == actions_list[-2].element == actions_list[-1].element:

                actions_list.remove(actions_list[-3])
                actions_list.remove(actions_list[-2])

            elif (actions_list[-3].action == 'insert_text'\
                and actions_list[-2].action == 'click'\
                and actions_list[-1].action == 'click')\
                and actions_list[-3].element == actions_list[-2].element == actions_list[-1].element:

                actions_list.remove(actions_list[-2])

    def save_recording(self):
        self.removeUselessKeyActions()

        self.splitActionsAndElements(self.actions)

        json_str = json.dumps(self.actions, default=lambda obj: obj.__dict__,sort_keys=True, indent=4)

        # define path
        file_name = str(self.scnName) + '.json'
        dir_path = './recordings'
        file_path = os.path.join(dir_path, file_name)
        if not os.path.isdir(dir_path):  #  create dir if dir doesnt exist
            os.mkdir(dir_path)

        # write to file
        with open(file_path, "w") as file:
            file.write(json_str)

    def removeUselessKeyActions(self):
        # odstraneni kombinaci special keys behem vkladani textu do STEJNEHO elementu

        # get indices of all insert_text actions
        idxs = [idx for idx, action in enumerate(self.actions) if action.action == 'insert_text']
        idxs_to_remove = []

        # check actions between every two indices without the last idx
        # and get indices of actions to remove
        for i in range(len(idxs)-1):
            check_actions = self.actions[idxs[i]:idxs[i+1]+1]
            same_element = True
            for j in range(len(check_actions)-1):
                if check_actions[j].element != check_actions[j+1].element:
                    same_element = False
                    break
            if same_element:
                idxs_to_remove = idxs_to_remove + (list(range(idxs[i],idxs[i+1])))

        # remove the actions
        for idx in sorted(idxs_to_remove, reverse=True):
            del self.actions[idx]


    def splitActionsAndElements(self, actions_list):
        # split akci (click, insert_text, keys, ..) zvlast na element a akci
        # pri posilani uz zvlast po sobe se obcas preskakuji,
        # proto rozdeleni az tady 
        for idx, action in enumerate(actions_list):
            if action.action == 'click' and hasattr(action, 'element'):
                element_action = Action()
                element_action.set_attributes({'action': 'find_element',
                                               'element': action.element,
                                               'is_opening_in_new_tab': action.is_opening_in_new_tab})

                del action.element
                del action.is_opening_in_new_tab
                actions_list.insert(idx, element_action)

            elif action.action == 'insert_text'\
                and hasattr(action, 'element'):

                element_action = Action()
                element_action.set_attributes({'action': 'find_element',
                                               'element': action.element})

                del action.element
                actions_list.insert(idx, element_action)

            # u key akci nechavam elementy pri nahravani,
            # hodi se pro prubezne promazavani akci,
            # ted mazu
            elif (action.action == 'keydown'\
                or action.action == 'keyup')\
                and hasattr(action, 'element'):

                del action.element
