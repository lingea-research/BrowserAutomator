import time

# selenium imports
from selenium import webdriver
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.chrome.options import Options

# driver imports
from replay_actions import *

# TODO: SWITCH IN IFRAMES

class Replay:
    def __init__(self, startingURL, scenario):
        self.startingURL = startingURL
        self.scenario = scenario
        self.driver_settings = scenario[0]
        self.driver = None
        self.wait = None 
        self.already_replayed = []

    def create_driver(self) -> webdriver:
        # extract driver parameters
        headless = self.driver_settings.get('headless')
        zoom = self.driver_settings.get('zoom')
        window_width = self.driver_settings.get('windowWidth')
        window_height = self.driver_settings.get('windowHeight')
        window_size = ','.join([str(window_width), str(window_height)])
        window_size_param = 'window-size=' + window_size
        label = self.driver_settings.get('label') or ""

        # set driver options
        options = Options()
        options.add_experimental_option("detach", True) # makes browser remain open
        options.add_argument(window_size_param)
        # Might be me issue? I guess it doesn't hurt though https://stackoverflow.com/a/60168019
        options.add_argument('--remote-debugging-port=9222')
        # TODO: Export, to make extension not hardcoded, also doesn't work in headless!!!
        # options.add_extension("path/to/file.crx")
        if self.driver_settings.get('label'):
            options.add_argument('--load-extension=/home/michalh/dev/repo/integrace/Indexer/browserviewindexer')
        options.headless = headless

        driver = webdriver.Chrome(options=options)
        self.driver = driver
        self.wait = WebDriverWait(self.driver, 10) # TODO: moznost nastaveni uzivatelem?

        driver.implicitly_wait(5)  

        # Setup indexer
        if self.driver_settings.get('label'):
            driver.get("chrome-extension://donbcfajbcabdplgmkpknmhfokoakgpl/options.html")
            driver.execute_script(f"chrome.storage.sync.set({{ \"autoIndex\": true, \"label\": \"{label}\" }});")

        # get starting URL / else: starting_URL already = starting_URL
        if self.startingURL == 'recordedURL':
            startingURL = self.driver_settings.get('startingURL')

        # navigate driver to first URL
        driver.get(startingURL)

        # TODO: set zoom level - UNRESOLVED BUG in selenium: elements not clickable after
        driver.execute_script("document.body.style.zoom = arguments[0]", zoom)



    def replay_scenario(self):
        # get scenario actions
        actions = self.scenario
        actions.remove(actions[0]) # first action is opening of new driver - settings

        current_focused_elements = []
        results_matrix = []

        # perform actions
        for action in actions:
            action_type = action.get('action')

            number_of_windows = len(self.driver.window_handles) # = tabs

            if action_type == 'find_element':
                recorded_element = action.get('element')
                current_focused_elements = [locate_element(recorded_element, self.driver, self.wait)]
                results_matrix = [[[elem]] for elem in current_focused_elements]
                # TODO: is_opening_in_new_tab
                is_opening_in_new_tab = action.get('is_opening_in_new_tab') # vrati None kdyz neni definovany

            elif action_type == 'selection':
                recorded_elements = action.get('elements')
                current_focused_elements = []
                for element in recorded_elements:
                    current_focused_elements.append(locate_element(element, self.driver, self.wait))
                
                results_matrix = [[[elem]] for elem in current_focused_elements]
                print(results_matrix)

            elif action_type == 'insert_text':
                text = action.get('value')
                insert_text(current_focused_elements, text, self.driver)
            
            elif action_type == 'keydown':
                count = action.get('count')
                key = action.get('key')
                keydown(key, count, self.driver, self.wait)

            elif action_type == 'keyup':
                count = action.get('count')
                key = action.get('key')
                keyup(key, self.driver, self.wait)

            elif action_type == 'click':

                # check new tab opening
                # TODO: Add as a type when recording, to the documentation etc?
                is_opening_in_new_tab = False
                if is_opening_in_new_tab == False:
                    click(current_focused_elements, self.driver, self.wait)
                elif is_opening_in_new_tab == True:
                    # get current window handles
                    current_handles = self.driver.window_handles
                    click(current_focused_elements, self.driver, self.wait)

                    # wait until new tab is opened
                    self.wait.until(EC.number_of_windows_to_be(number_of_windows + 1))

                    # switch control to new tab/window
                    for window_handle in self.driver.window_handles:
                        if window_handle not in current_handles:
                            self.driver.switch_to.window(window_handle)
                            #used_window_handles.append(window_handle)
                            break

            elif action_type == 'open_in_new_tab':
                open_in_new_tab(current_focused_elements, self.driver, self.wait)

            elif action_type == 'add_to_dataset':
                dataset = action.get('dataset')
                value_to_save = action.get('save')

                if value_to_save == 'attribute':
                    value_to_save = action.get('attribute')

                data_to_save = extract_data_from_elements(value_to_save, results_matrix, self.driver)

                write_to_dataset(data_to_save, dataset)

            elif action_type == 'classifier':
                classifier = action.get('classifier')
                print('CLASSIFIER:', classifier)

                current_focused_elements = classify(self.driver, classifier)
                results_matrix = [[[elem]] for elem in current_focused_elements]

            elif action_type == 'conditioned_classifier':
                classifier = action.get('classifier')
                condition = action.get('condition')
                print('CLASSIFIER:', classifier)

                current_focused_elements = []

                parameters_ids = []
                parameters = classify(self.driver, condition)

                # create empty matrix for results
                # 2 = 1 podmineny + 1 nepodmineny
                results_matrix = [[None] * 2 for row in (parameters)]

                for idx, parameter in enumerate(parameters):
                    parameter_id = get_masapi_id(parameter, self.driver)
                    parameters_ids.append(parameter_id)
                    # ukladam listy jednotlivych elementu
                    results_matrix[idx][0] = [parameter]

                # iterate over pamaremeters and classify
                for param_idx, parameter_id in enumerate(parameters_ids):
                    print('parameters:', parameters_ids) 
                    result_elements = classify(self.driver, classifier, parameter_id)
                    if (result_elements):
                        current_focused_elements.append(*result_elements) # nemusi byt?
                        results_matrix[param_idx][1] = result_elements
                        del result_elements

            elif action_type == 'clf_sequence':
                clf_sequence = action.get('clf_sequence')
                condition = action.get('condition')
                
                # TODO: dodelat pro jine nez klasifikator
                if condition.get('action') == 'classifier':
                    classifier = condition.get('classifier')
                    parameters = classify(self.driver, classifier)

                current_focused_elements = [] # TODO: nechat prazdne?

                parameters_ids = []

                # create empty matrix for results
                # len(clf_sequence)+1 = podminene + 1 nepodmineny
                results_matrix = [[None] * (len(clf_sequence)+1) for row in (parameters)]

                for idx, parameter in enumerate(parameters):
                    parameter_id = get_masapi_id(parameter, self.driver)
                    parameters_ids.append(parameter_id)
                    # ukladam listy jednotlivych elementu
                    results_matrix[idx][0] = [parameter]

                for clf_idx, classifier in enumerate(clf_sequence):
                    print('CLF in clf sequence:', classifier)
                    col_idx = clf_idx + 1 # 0. sloupec je podminka

                    # jestli parametry pouzit po jednom, nebo jako skupinu
                    # zatim defaultne zvlast
                    use_parameters_separately = True 

                    if use_parameters_separately:
                        # iterate over pamaremeters and classify
                        for param_idx, parameter_id in enumerate(parameters_ids):
                            print('parameter:', parameter_id) 
                            result_elements = classify(self.driver, classifier, parameter_id)
                            if (result_elements):
                                current_focused_elements.append(*result_elements) # nemusi byt?
                                results_matrix[param_idx][col_idx] = result_elements
                                del result_elements

                    else:
                        # pouziti parametru jako skupiny
                        pass
            elif action_type == 'close_browser':
                print('action:', action_type, 'DONE')
                self.already_replayed.append(action) # jen pro info

                print('REPLAY FINISHED')
                time.sleep(2)
                self.driver.quit()

            print('action:', action_type, 'DONE')
            self.already_replayed.append(action) # jen pro info

