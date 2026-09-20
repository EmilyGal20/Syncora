import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'

const en={translation:{
  nav:{dashboard:'Dashboard',tasks:'My Work',schedule:'Schedule',teams:'Teams',announcements:'Announcements',admin:'Administration',settings:'Settings'},
  common:{add:'Add',save:'Save',cancel:'Cancel',delete:'Delete',edit:'Edit',close:'Close',loading:'Loading',none:'None',saveError:'Could not save your changes. Please try again.'},
  auth:{signIn:'Sign in',signingIn:'Signing in',preparing:'Preparing your workspace...',welcome:'Welcome back',subtitle:'Sign in to your organization workspace.',email:'Work email',password:'Password',invalid:'The email or password is incorrect.',development:'Development workspace credentials are prefilled locally.',brandMessage:'Plan work, manage access, and keep your organization connected.'},
  dashboard:{title:'Good morning',subtitle:'Here is what needs your attention today.'},
  tasks:{title:'Tasks',subtitle:'Plan and track work across your teams.',new:'New task'},
  schedule:{title:'Schedule',new:'New event',edit:'Edit event',editEvent:'Edit event',details:'Event details',eventTitle:'Event title',description:'Description',date:'Date',start:'Start time',end:'End time',allDay:'All-day',location:'Location',visibility:'Visibility',team:'Team',participants:'Participants',invalidRange:'End time must be after start time.',required:'Choose a date and time.',today:'Today',month:'Month',week:'Week',day:'Day',userFilter:'View schedule for',allUsers:'All users',confirmDelete:'Delete this event?',visibilityValues:{private:'Private',participants:'Participants',team:'Team',department:'Department',organization:'Organization'}},
  teams:{title:'Teams',new:'New team'},announcements:{title:'Announcements',new:'New announcement'},
  admin:{title:'Admin Center',subtitle:'Configure your organization and control access.',overview:'Overview',users:'Users',roles:'User Types / Roles',permissions:'Access Matrix',navigation:'Navigation'},
  settings:{title:'Settings',language:'Language',appearance:'Appearance',light:'Light',dark:'Dark',system:'System'},
  errors:{forbidden:'You do not have permission to access this area.'}
}}

const he={translation:{
  nav:{dashboard:'לוח מחוונים',tasks:'העבודה שלי',schedule:'לוח שנה',teams:'צוותים',announcements:'הודעות',admin:'ניהול',settings:'הגדרות'},
  common:{add:'הוספה',save:'שמירה',cancel:'ביטול',delete:'מחיקה',edit:'עריכה',close:'סגירה',loading:'טוען',none:'ללא',saveError:'לא ניתן לשמור את השינויים. נסו שוב.'},
  auth:{signIn:'כניסה',signingIn:'מתחברים',preparing:'מכינים את סביבת העבודה שלך...',welcome:'ברוכים השבים',subtitle:'היכנסו לסביבת העבודה של הארגון.',email:'דוא״ל ארגוני',password:'סיסמה',invalid:'כתובת הדוא״ל או הסיסמה שגויות.',development:'פרטי סביבת הפיתוח מוזנים מראש באופן מקומי.',brandMessage:'מתכננים עבודה, מנהלים גישה ושומרים על הארגון מחובר.'},
  dashboard:{title:'בוקר טוב',subtitle:'הדברים שדורשים את תשומת ליבך היום.'},
  tasks:{title:'משימות',subtitle:'תכנון ומעקב אחר העבודה בצוותים.',new:'משימה חדשה'},
  schedule:{title:'לוח שנה',new:'אירוע חדש',edit:'עריכת אירוע',editEvent:'עריכת אירוע',details:'פרטי האירוע',eventTitle:'שם האירוע',description:'תיאור',date:'תאריך',start:'שעת התחלה',end:'שעת סיום',allDay:'כל היום',location:'מיקום',visibility:'חשיפה',team:'צוות',participants:'משתתפים',invalidRange:'שעת הסיום חייבת להיות אחרי שעת ההתחלה.',required:'יש לבחור תאריך ושעה.',today:'היום',month:'חודש',week:'שבוע',day:'יום',userFilter:'הצגת לוח שנה עבור',allUsers:'כל המשתמשים',confirmDelete:'למחוק את האירוע?',visibilityValues:{private:'פרטי',participants:'משתתפים',team:'צוות',department:'מחלקה',organization:'ארגון'}},
  teams:{title:'צוותים',new:'צוות חדש'},announcements:{title:'הודעות',new:'הודעה חדשה'},
  admin:{title:'מרכז ניהול',subtitle:'הגדרת הארגון וניהול הגישה.',overview:'סקירה',users:'משתמשים',roles:'סוגי משתמשים ותפקידים',permissions:'מטריצת גישה',navigation:'ניווט'},
  settings:{title:'הגדרות',language:'שפה',appearance:'מראה',light:'בהיר',dark:'כהה',system:'מערכת'},
  errors:{forbidden:'אין לך הרשאה לגשת לאזור זה.'}
}}

void i18n.use(initReactI18next).init({resources:{en,he},lng:'en',fallbackLng:'en',interpolation:{escapeValue:false}})
export default i18n
