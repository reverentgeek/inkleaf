use tauri::{
    menu::{AboutMetadata, MenuBuilder, MenuItemBuilder, PredefinedMenuItem, SubmenuBuilder},
    Emitter,
};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .setup(|app| {
            let keyboard_shortcuts = MenuItemBuilder::new("Keyboard Shortcuts")
                .id("keyboard_shortcuts")
                .accelerator("CmdOrCtrl+/")
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
                .items(&[&app_submenu, &edit_submenu, &view_submenu, &window_submenu, &help_submenu])
                .build()?;

            app.set_menu(menu)?;

            app.on_menu_event(move |app, event| {
                if event.id() == keyboard_shortcuts.id() {
                    let _ = app.emit("show-keyboard-shortcuts", ());
                }
            });

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
