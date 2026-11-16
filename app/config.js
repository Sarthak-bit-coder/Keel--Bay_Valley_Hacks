// Accounts for "My pay" (app/my-pay.html). Setup steps: app/MY_PAY_SETUP.md
//
// googleClientId: the PUBLIC OAuth client ID from Google Cloud. Turns on "Sign up with Google".
//   Never put the Google client SECRET in this file: everything here is visible to anyone.
//   In Google Cloud, the client must list these "Authorized JavaScript origins":
//   http://localhost:8765, http://localhost:8000, https://sarthak-bit-coder.github.io
//
// Supabase (optional): with url + anonKey set, accounts are stored in the cloud (app/supabase_schema.sql).
// Without them, accounts are saved on the device (app/localauth.js): passwords hashed, data encrypted.
window.KEEL_SUPABASE = {
  url: "",
  anonKey: ""
};
window.KEEL_GOOGLE_CLIENT_ID = "470899433943-ukonbr1oc0f48oo4papqo81jubjl2ms7.apps.googleusercontent.com";
