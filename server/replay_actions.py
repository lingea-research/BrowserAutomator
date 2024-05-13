import csv
import os
import xgboost as xgb

# selenium imports
from selenium.webdriver.common.by import By
from selenium.webdriver.common.keys import Keys
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.common.action_chains import ActionChains
from selenium.common.exceptions import MoveTargetOutOfBoundsException, NoSuchElementException, ElementNotInteractableException

# js imports
from javascript_functions import extract_elements, match_suggested, masapi_id

# py imports
from document import Document
from utils import prediction
from extracting_elements_attributes import extract_attribute
from keys import Keys


def locate_element(element, driver, wait):
    try:
        # element = driver.find_element(By.XPATH, action.get('element').get('xpath'))
        element = wait.until(EC.presence_of_element_located((By.XPATH, element.get('xpath'))))
    except NoSuchElementException:
        try:
            element = driver.find_element(By.XPATH, element.get('abs_xpath'))
            
        except NoSuchElementException:
            pass
    # TODO: ukoncit prehravani nebo neco, kdyz element nenalezen
    # (UnboundLocalError: local variable 'element' referenced before assignment)
    return element

def click(elements, driver, wait):
    for element in elements:
        # nekde funguje click() (lista googlu), nekde js (preklikavani na mozilla dev), nevim duvod
        # update: vypada to, ze 'MoveTargetOutOfBoundsException' je zpusoben move_to_element(element)
        try:
            wait.until(EC.element_to_be_clickable(element))
            ActionChains(driver).move_to_element(element).click(element).perform() 

        except MoveTargetOutOfBoundsException:
            driver.execute_script("arguments[0].click();", element)

def insert_text(elements, text, driver):
    for element in elements:
        driver.execute_script("arguments[0].value = arguments[1];", element, text)
    

def open_in_new_tab(elements, driver, wait):

    # TODO: for OSX: COMMAND + 't'
    # muze se hodit:  cmd_ctrl = Keys.COMMAND if sys.platform == 'darwin' else Keys.CONTROL
    # zdroj: https://www.selenium.dev/documentation/webdriver/actions_api/keyboard/
    for element in elements:
        try:
            # version with (click())
            wait.until(EC.element_to_be_clickable(element))
            ActionChains(driver).key_down(Keys.CONTROL_LEFT).click(element)\
                                .key_up(Keys.CONTROL_LEFT).perform()

        except MoveTargetOutOfBoundsException:
            try:
                # version without (click())
                element.send_keys(Keys.CONTROL_LEFT + Keys.ENTER) 
            except ElementNotInteractableException:
                pass

def classify(driver, classifier, parameter = None):
    if parameter:
        is_conditioned = True
    else:
        is_conditioned = False

    # extract elements
    body = driver.find_element(By.TAG_NAME, "BODY")
    elements = driver.execute_script(extract_elements, body)

    # process to dataframes, ...
    DOM = Document(None, None, None, elements, classifier, None)
    DOM.preprocess_received_data()

    # load classifier
    model = load_clf_model(classifier)

    if is_conditioned:
        # parameter = masapi-ID elementu, ktery slouzi jako podminka
        DOM.compute_condition_attributes(parameter, model)

    _, _, X_all, _, _, _ = DOM.create_DFs()
    
    # classify
    y_all = prediction(model, X_all)
    #print(y_all)
    suggested = DOM.get_suggested_elements(y_all, X_all) #DF_elements ?
    matched_elements_list = driver.execute_script(match_suggested, body, suggested)
    return matched_elements_list

def get_masapi_id(element, driver):
    elem_masapi_id = driver.execute_script(masapi_id, element)
    return elem_masapi_id

def extract_data_from_elements(attribute_to_save, elements_matrix, driver):
    data_to_save = []
    attrs_matrix = [[None] * (len(elements_matrix[0])) for row in (elements_matrix)]


    for row_idx, row in enumerate(elements_matrix):
        for col_idx, col_elements in enumerate(row):
            if len(col_elements) == 1:
                # zatim predpokladam jeden element
                element = col_elements[0]

                attribute_value = extract_attribute(attribute_to_save, element, driver)

                attrs_matrix[row_idx][col_idx] = attribute_value

            else:
                #TODO: nektery prvek obsahuje vice nebo 0 elementu
                pass

        data_to_save = attrs_matrix

    print('data_to_save', data_to_save)
    return data_to_save

def write_to_dataset(data_to_save, dataset):
    dataset_name = dataset + '.csv'
    dir_path = './datasets'
    dataset_path = os.path.join(dir_path, dataset_name)

    # create dir if dir doesnt exist
    if not os.path.isdir(dir_path):
        os.mkdir(dir_path)

    is_new_dataset = not(os.path.exists(dataset_path))
    print('is_new_dataset:', is_new_dataset)

    with open(dataset_path, 'a+', newline='') as file:
        writer = csv.writer(file)

        writer.writerows(data_to_save)
        file.close()

def load_clf_model(clfname):
    clf_file_name = str(clfname) + '.json'
    clf_path = os.path.join('./clfs', clf_file_name)
    model = xgb.XGBClassifier()
    model.load_model(clf_path)
    return model


def keydown(key, count, driver, wait):
    # selenium keyboard actions: https://www.w3.org/TR/webdriver/#keyboard-actions
    #ActionChains(driver).key_down(key_code, element).perform()
    # s parametrem 'element' nefunguje - rozklikava se odkaz
    key_code = Keys.get(key)
    if key_code is not None:
        # kontrola, ze nemam nahranou nejakou divnou klavesu (napr. ContextMenu),
        # ktera neni ve slovniku Keys
        for _ in range(count):
            ActionChains(driver).key_down(key_code).perform()

def keyup(key, driver, wait):
    key_code = Keys.get(key)
    if key_code is not None:
        ActionChains(driver).key_up(key_code).perform()
