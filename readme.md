## Installing the extension
- go to *chrome://extensions/*
- enable **Developer mode** in the right upper corner
- go to **Load unpacked** and load the **browser_automator_extension** directory
- go to **Details** of the extension and enable **Allow in incognito**
- click the puzzle (Extensions) icon and **pin** the extension

## Running the Flask server
#### Installing requirements
- go to **python/root** directory
- run: pip install -r requirements.txt
#### Running the server
- run: browser_automator.py

## HTTP messages
**URL**: http://localhost:8081/automator/  
**Method**: POST  
**Request header**: Content-Type: multipart/form-data  
**Request body**: Multipart with attributes 'type' and 'content'  

    1. to get saved files:  
        type: "get_saved_files"  
        content:  {file_type: "$FILE_TYPE"}
            $FILE_TYPE =  "recordings", "datasets" or "clfs"

        response: {"type": "get_saved_files" , "content": {"file_type": "$FILE_TYPE", "file_list": "$FILE_LIST"}}
            $FILE_LIST = array of names of saved files (without suffixes)
        
    2. to get saved recording json:  
        type: "send_recording_json"  
        content: {"chosenScn":"$NAME"}  
            $NAME = name of recording to load (without '.json')

        response: {"type": "send_recording_json", "content": "$RECORDING_JSON"}
            $RECORDING_JSON = loaded json of recording

    3. to replay (customized) json:  
        type: "replay_this_json"  
        content: {"scenario":"$JSON", "starting_URL": $URL}  
            $JSON = (customized) recording json  
            $URL = specify URL to start replay on, or add "recordedURL" to start replay on the same URL as recorded

        response: {"type": "replay_this_json", "content": ""}

    4. to delete files:
        type: "delete_file"  
        content:  {"file_type": "$TYPE", "file_name": "$NAME"}
            $TYPE = "recording", "classifier" or "dataset"
            $NAME = name of file (without '.json' or '.csv' suffix)

        response: {"type": "delete_file", "content": ""}

    5. to get replay status:
        type: "get_replay_status"  
        content:  ""

        response: {"type": "get_replay_status", "content": "$STATUS"}
            $STATUS = array of already successfully replayed actions (same objects as in the recording json)

**Responses**: in the JSON format with "type" and "content"  



## TIPS
- start recordings in **incognito mode** to make sure you get the same page setup (pop up windows, cookies, ...) as while replaying
- after changing the extension code, **reload the extension** in *chrome://extensions/* and **reload the page**, where you will use the new changed extension
- record with browser **zoom set to 100 %**