use tauri::{
    menu::{AboutMetadata, MenuBuilder, MenuItemBuilder, PredefinedMenuItem, SubmenuBuilder},
    Emitter,
};

#[tauri::command]
fn open_external(url: String) -> Result<(), String> {
    open::that(&url).map_err(|e| e.to_string())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .invoke_handler(tauri::generate_handler![open_external])
        .setup(|app| {
            let keyboard_shortcuts = MenuItemBuilder::new("Keyboard Shortcuts")
                .id("keyboard_shortcuts")
                .accelerator("CmdOrCtrl+/")
                .build(app)?;

            let import_note = MenuItemBuilder::new("Import Markdown…")
                .id("import_note")
                .accelerator("CmdOrCtrl+O")
                .build(app)?;

            let export_note = MenuItemBuilder::new("Export as Markdown…")
                .id("export_note")
                .accelerator("CmdOrCtrl+S")
                .build(app)?;

            let app_submenu = SubmenuBuilder::new(app, "Inkleaf")
                .about(Some(AboutMetadata {
                    ..Default::default()
                }))
                .separator()
                .services()
                .separator()
                .hide()
                .hide_others()
                .show_all()
                .separator()
                .quit()
                .build()?;

            let file_submenu = SubmenuBuilder::new(app, "File")
                .item(&import_note)
                .item(&export_note)
                .build()?;

            let edit_submenu = SubmenuBuilder::new(app, "Edit")
                .undo()
                .redo()
                .separator()
                .cut()
                .copy()
                .paste()
                .select_all()
                .build()?;

            let view_submenu = SubmenuBuilder::new(app, "View")
                .item(&PredefinedMenuItem::fullscreen(app, None)?)
                .build()?;

            let window_submenu = SubmenuBuilder::new(app, "Window")
                .minimize()
                .item(&PredefinedMenuItem::maximize(app, None)?)
                .close_window()
                .build()?;

            let help_submenu = SubmenuBuilder::new(app, "Help")
                .item(&keyboard_shortcuts)
                .build()?;

            let menu = MenuBuilder::new(app)
                .items(&[&app_submenu, &file_submenu, &edit_submenu, &view_submenu, &window_submenu, &help_submenu])
                .build()?;

            app.set_menu(menu)?;

            app.on_menu_event(move |app, event| {
                if event.id() == keyboard_shortcuts.id() {
                    let _ = app.emit("show-keyboard-shortcuts", ());
                } else if event.id() == import_note.id() {
                    let _ = app.emit("menu-import", ());
                } else if event.id() == export_note.id() {
                    let _ = app.emit("menu-export", ());
                }
            });

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
