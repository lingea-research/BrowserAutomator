## Popis scénáře
- scénář = posloupnost objektů jednotlivých akcí
- akce lze rozdělit na: 
    - ty, které vybírají požadované elementy (find_element, classifier, conditioned_classifier, clf_sequence, selection)
    - ty, které s již vybranými elementy vykonávají akce (click, open_in_new_tab, add_to_dataset, insert_text)
    - ostatní (open_browser, close_browser, keydown, keyup)

## Popis akcí

### open_browser
- nastavuje vlastnosti nového webdriveru při spuštění, později už měnit nelze
- **headless:** nastavení, jestli přehrávání probíhá s GUI prohlížeče, při nahrávání scénáře defaultně nastaveno na false
- **startingURL:** URL, na které bylo zahájeno nahrávání, pro přehrávání lze použít, nebo změnit
- **windowHeight**, **windowWidth**, **zoom:** vlastnosti okna při nahrávání, pro přehrávání musí být stejné, jinak nespolehlivé vyhledávání elementů (bug Selenia se zoomem jiným než 1, změny dokumentu při jiných velikostech okna)
- **label** nepovinný argument, který se používá při indexaci browserviewindexerem

        {
            "action": "open_browser",
            "headless": false,
            "startingURL": "https://www.selenium.dev/documentation/webdriver/browsers/internet_explorer/",
            "windowHeight": 1058,
            "windowWidth": 1872,
            "zoom": 1,
            "label": "hello"
        }

### close_browser
- ukončí daný webdriver

        {
            "action": "close_browser"
        }


### keydown
- stisknutí klávesy na klávesnici
- keydown a keyup akce nejsou vázány ke konkrétnímu elementu,  
    v případě současného vkládání textu do elementu jsou tyto akce mazány a ponechány pouze akce **insert_text**,  
    pokud klávesové akce slouží ke změně zaměřeného elementu (Tab, Shift + Tab), předpokládá se, že aktuální focus je při přehrávání ve webdriveru stejný, jako byl při nahrávání
- **count:** počet opakování stejné akce
- **key:** stisknutá klávesa

        {
            "action": "keydown",
            "count": 82,
            "key": "ArrowDown"
        }


### keyup
- uvolnění klávesy na klávesnici
- keydown a keyup akce nejsou vázány ke konkrétnímu elementu,  
    v případě současného vkládání textu do elementu jsou tyto akce mazány a ponechány pouze akce **insert_text**,  
    pokud klávesové akce slouží ke změně zaměřeného elementu (Tab, Shift + Tab), předpokládá se, že aktuální focus je při přehrávání ve webdriveru stejný, jako byl při nahrávání
- **key:** uvolněná klávesa

        {
            "action": "keyup",
            "key": "ArrowDown"
        }

### find_element
- vyhledává element, při nahrávání momentálně pouze po kliknutí
- **element:** selektory elementu
- **is_opening_in_new_tab:** jestli se odkaz po kliknutí otevírá v nové záložce (v té dále pokračuje nahrávání/ přehrávání)

        {
            "action": "find_element",
            "element": {
                "abs_xpath": "/html/body/div/div[1]/div/aside[1]/div/nav/ul/li/ul/li[2]/ul/li[3]/a/span",
                "xpath": "//*[@id=\"m-documentationwebdriverbrowsers\"]/span"
            },
            "is_opening_in_new_tab": false
        }

### classifier
- použití uloženého klasifikátoru - vrací vybrané elementy
- **classifier:** název klasifikátoru bez přípony

        {
            "action": "classifier",
            "classifier": "muj_klasifikator"
        }

### conditioned_classifier
- použití podmíněného klasifikátoru
- **classifier:** název podmíněného klasifikátoru
- **condition:** název klasifikátoru sloužícího jako podmínka

        {
            "action": "conditioned_classifier",
            "classifier": "muj_podmineny_klasifikator",
            "condition": "muj_klasifikator"
        }

### clf_sequence
- výběr elementů více klasifikátory podmíněnými jedním stejným klasifikátorem
- **clf_sequence:** posloupnost podmíněných klasifikátorů
- **condition:** podmínka pro podmíněné klasifikátory (zatím pouze klasifikátor, časem předpokládám i ruční výběr, nebo pouze jeden element)

        {
            "action": "clf_sequence",
            "clf_sequence": ["text_pod_linkem", "texty_pod_linkem_2", "pozadi_linku"],
            "condition": {
                "action": "classifier",
                "classifier": "linky"
            }
        }

### selection
- ruční výběr - poklikání několika libovolných elementů
- **elements:** množina elementů a jejich selektorů

        {
            "action": "selection",
            "elements": [
                {
                    "abs_xpath": "/html/body/div[1]/div[4]/main/div[1]/div/a[1]",
                    "xpath": "/html/body/div[1]/div[4]/main/div[1]/div/a[1]"
                },
                {
                    "abs_xpath": "/html/body/div[1]/div[4]/main/div[1]/div/a[2]",
                    "xpath": "/html/body/div[1]/div[4]/main/div[1]/div/a[2]"
                }
            ]
        }

### click
- kliknutí na element

        {
            "action": "click"
        }

### open_in_new_tab
- otevření linku v nové záložce

        {
            "action": "open_in_new_tab"
        }

### add_to_dataset
- uložení hodnot z elementu do datasetu
- **dataset:** název datasetu bez přípony (pokud neexistuje, je vytvořen, jinak jsou hodnoty přidány na konec)
- **save:** atribut, který má být uložen  
        - možnosti: "outerHTML", "innerHTML", "text", "URL", "attribute"  
        - v případě **"save": "attribute"** přibývá akci atribut **"attribute"** s názvem atributu, který má být stažen (viz příklady níže)  
        - "URL" vrací **href** pro **a** tagy, **src** pro **img** tagy  

        {
            "action": "add_to_dataset",
            "dataset": "kl_dataset",
            "save": "innerHTML"
        }
    nebo

        {
            "action": "add_to_dataset",
            "dataset": "kl_dataset",
            "save": "attribute",
            "attribute": "class"
        }

### insert_text
- vložení textu
- **value:** hodnota, která má být vložena

        {
            "action": "insert_text",
            "value": "nejaky text"
        }
  

## Příklad celého scénáře:

    [
        {
            "action": "open_browser",
            "headless": false,
            "startingURL": "https://www.selenium.dev/documentation/webdriver/browsers/internet_explorer/",
            "windowHeight": 1058,
            "windowWidth": 1872,
            "zoom": 1
        },
        {
            "action": "find_element",
            "element": {
                "abs_xpath": "/html/body/div/div[1]/div/aside[1]/div/nav/ul/li/ul/li[2]/ul/li[3]/a/span",
                "xpath": "//*[@id=\"m-documentationwebdriverbrowsers\"]/span"
            },
            "is_opening_in_new_tab": false
        },
        {
            "action": "click"
        },
        {
            "action": "classifier",
            "classifier": "kl"
        },
        {
            "action": "open_in_new_tab"
        },
        {
            "action": "conditioned_classifier",
            "classifier": "kl_podm",
            "condition": "kl"
        },
        {
            "action": "add_to_dataset",
            "dataset": "kl_dataset",
            "save": "text"
        },
        {
            "action": "find_element",
            "element": {
                "abs_xpath": "/html/body/div/div[1]/div/aside[1]/div/nav/ul/li/ul/li[1]/a",
                "xpath": "//*[@id=\"m-documentationoverview\"]"
            },
            "is_opening_in_new_tab": false
        },
        {
            "action": "click"
        },
        {
            "action": "find_element",
            "element": {
                "abs_xpath": "/html/body/div/div[1]/div/aside[2]/div[1]/a[2]",
                "xpath": "/html/body/div/div[1]/div/aside[2]/div[1]/a[2]"
            },
            "is_opening_in_new_tab": true
        },
        {
            "action": "click"
        },
        {
            "action": "find_element",
            "element": {
                "abs_xpath": "/html/body/div[1]/div[4]/ul/li[3]/a",
                "xpath": "/html/body/div[1]/div[4]/ul/li[3]/a"
            },
            "is_opening_in_new_tab": false
        },
        {
            "action": "click"
        },
        {
            "action": "selection",
            "elements": [
                {
                    "abs_xpath": "/html/body/div[1]/div[4]/main/div[1]/div/a[1]",
                    "xpath": "/html/body/div[1]/div[4]/main/div[1]/div/a[1]"
                },
                {
                    "abs_xpath": "/html/body/div[1]/div[4]/main/div[1]/div/a[2]",
                    "xpath": "/html/body/div[1]/div[4]/main/div[1]/div/a[2]"
                }
            ]
        },
        {
            "action": "open_in_new_tab"
        },
        {
            "action": "find_element",
            "element": {
                "abs_xpath": "/html/body/div[1]/div[1]/header/div/div[2]/div/div/div[1]/div/div/form/label/input[1]",
                "xpath": "/html/body/div[1]/div[1]/header/div/div[2]/div/div/div[1]/div/div/form/label/input[1]"
            },
            "is_opening_in_new_tab": false
        },
        {
            "action": "click"
        },
        {
            "action": "find_element",
            "element": {
                "abs_xpath": "/html/body/div[1]/div[1]/header/div/div[2]/div/div/div[1]/div/div/form/label/input[1]",
                "xpath": "/html/body/div[1]/div[1]/header/div/div[2]/div/div/div[1]/div/div/form/label/input[1]"
            }
        },
        {
            "action": "insert_text",
            "value": "nejaky text"
        },
        {
            "action": "close_browser"
        }
    ]