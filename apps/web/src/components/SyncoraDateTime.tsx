import { DatePicker } from '@mui/x-date-pickers/DatePicker'
import { TimePicker } from '@mui/x-date-pickers/TimePicker'
import { useTranslation } from 'react-i18next'

interface PickerProps{label:string;value:Date|null;onChange:(value:Date|null)=>void;error?:string;disabled?:boolean}

export function SyncoraDatePicker({label,value,onChange,error,disabled}:PickerProps){const {i18n}=useTranslation();return <DatePicker label={label} value={value} onChange={onChange} disabled={disabled} format={i18n.language==='he'?'dd/MM/yyyy':'MMM d, yyyy'} slotProps={{textField:{fullWidth:true,error:!!error,helperText:error}}}/>}

export function SyncoraTimePicker({label,value,onChange,error,disabled}:PickerProps){const {i18n}=useTranslation();return <TimePicker label={label} value={value} onChange={onChange} disabled={disabled} ampm={i18n.language!=='he'} minutesStep={5} slotProps={{textField:{fullWidth:true,error:!!error,helperText:error}}}/>}
