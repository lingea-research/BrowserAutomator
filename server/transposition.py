class Transposition:
    def __init__(self, id_transp, selected_id_parts, curr_cond_id_parts):
        self.id_transp = id_transp
        self.selected_id_parts = selected_id_parts
        self.curr_cond_id_parts = curr_cond_id_parts
        self.sel_appdx = None
        self.cond_appdx = None

    def create_feature_name(self):
        transp_part = 'transposition_' + ';'.join(str(i) for i in self.id_transp)

        if self.sel_appdx:
            sel_appdx_part = ';'.join(str(i) for i in self.sel_appdx)
        else:
            sel_appdx_part = ''

        if self.cond_appdx:
            cond_appdx_part = ';'.join(str(i) for i in self.cond_appdx)
        else:
            cond_appdx_part = ''

        feature_name = transp_part + '#' + sel_appdx_part + '#' + cond_appdx_part
        return feature_name
