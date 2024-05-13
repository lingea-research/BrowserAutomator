class Action:
    def __init__(self):
        pass

    def set_attributes(self, actionObj):
        for attribute, value in actionObj.items():
            setattr(self, attribute, value)