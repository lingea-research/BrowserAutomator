# js imports
from javascript_functions import get_text

def extract_attribute(attribute, element, driver):

    if attribute == 'outerHTML':
        attribute_value = element.get_attribute('outerHTML').replace('\n', '')

    elif attribute == 'innerHTML':
        attribute_value = element.get_attribute('innerHTML').replace('\n', '')

    elif attribute == 'URL':
        tagname = element.get_attribute('tagName').lower()

        if tagname == 'img':
            attribute_value = element.get_attribute('src')
        else:
            # pro <a> = href, jinak vsude vrati None
            attribute_value = element.get_attribute('href')

    elif attribute == 'tag':
        tagname = element.get_attribute('tagName')

        attribute_value = tagname

    elif attribute == 'text':
        # get_text jinak vraci list - rozsekane vnitrky
        attribute_value = ','.join(driver.execute_script(get_text, element))
        attribute_value = attribute_value.replace('\n', ' ')

    else:
        # random uzivatelem zadany atribut
        attribute_value = element.get_attribute(attribute)
        if attribute_value is not None:
            attribute_value = attribute_value.replace('\n', '')

    return attribute_value