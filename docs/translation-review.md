# Translation Review — Phase 1 i18n (Turkish drafts)

**Purpose:** Antigravity Claude has produced Turkish draft translations for all externalized UI strings. Per the Phase 1 brief, **Muhlis does the final pass** — especially for MBSE / systems-engineering terminology where literal translation may not match Turkish academic/professional convention.

**Source of truth:** `packages/web-client/src/i18n/{en,tr}.json`. Edits here are not picked up automatically — update both JSON files when you settle on a final translation.

**Style guide reminders (from brief §8):**
- Siz-dil for instructions (`E-posta adresinizi girin`), short infinitive form for button labels (`Giriş yap`).
- No `lütfen` softener.
- Errors state facts without blame.

**Legend:**
- 🟢 Standard — straightforward translation, low review risk.
- 🟡 Review — phrasing/word choice may have a better alternative.
- 🔴 MBSE jargon — engineering term that needs domain validation.
- ⚪ Loanword/keep-English — kept as-is by design (brand, protocol acronym, etc.).

---

## `common.*`

| Key | EN | TR (draft) | Flag | Notes |
|---|---|---|---|---|
| `loading` | Loading... | Yükleniyor... | 🟢 | |
| `please_wait` | Please wait... | Bekleyin... | 🟢 | Brief §8 forbids `lütfen`; kept short. |
| `save` | Save | Kaydet | 🟢 | |
| `saving` | Saving... | Kaydediliyor... | 🟢 | |
| `saved` | Saved | Kaydedildi | 🟢 | |
| `cancel` | Cancel | İptal | 🟢 | |
| `close` | Close | Kapat | 🟢 | |
| `back_to_signin` | Back to Sign In | Girişe geri dön | 🟡 | Alt: "Girişe dön" (more concise). |
| `or` | or | veya | 🟢 | |

## `auth.*`

| Key | EN | TR (draft) | Flag | Notes |
|---|---|---|---|---|
| `brand_tagline` | SysML v2 Modeling Platform | SysML v2 Modelleme Platformu | 🟡 | "Platform" loanword is common but "ortam" possible. |
| `tabs.login` | Sign In | Giriş yap | 🟢 | |
| `tabs.register` | Create Account | Hesap oluştur | 🟢 | |
| `login.email_placeholder` | Email | E-posta | 🟢 | |
| `login.password_placeholder` | Password | Parola | 🟡 | Alt: "Şifre" — both widely used; "Parola" is TDK-formal. |
| `login.submit` | Sign In | Giriş yap | 🟢 | |
| `login.forgot_link` | Forgot password? | Parolanızı mı unuttunuz? | 🟢 | |
| `register.name_placeholder` | Full name | Ad soyad | 🟢 | |
| `register.success` | Account created! ... | Hesabınız oluşturuldu. E-postanıza gönderilen doğrulama bağlantısını kontrol edin. | 🟢 | |
| `forgot.title` | Forgot Password | Parolayı sıfırla | 🟢 | |
| `forgot.description` | Enter your email address ... | E-posta adresinizi girin, parolanızı sıfırlamak için bağlantı göndereceğiz. | 🟢 | |
| `forgot.submit` | Send Reset Link | Sıfırlama bağlantısı gönder | 🟢 | |
| `forgot.sending` | Sending... | Gönderiliyor... | 🟢 | |
| `forgot.failed` | Failed to send reset email | Sıfırlama e-postası gönderilemedi | 🟢 | |
| `forgot.email_required` | Please enter your email address | E-posta adresinizi girin | 🟢 | |
| `reset.title` | Set New Password | Yeni parola belirle | 🟢 | |
| `reset.new_password_placeholder` | New password (min 8 characters) | Yeni parola (en az 8 karakter) | 🟢 | |
| `reset.confirm_placeholder` | Confirm new password | Yeni parolayı tekrar girin | 🟢 | |
| `reset.submit` | Reset Password | Parolayı sıfırla | 🟢 | |
| `reset.passwords_mismatch` | Passwords do not match | Parolalar eşleşmiyor | 🟢 | |
| `reset.password_too_short` | Password must be at least 8 characters | Parola en az 8 karakter olmalı | 🟢 | |
| `reset.failed` | Failed to reset password | Parola sıfırlanamadı | 🟢 | |
| `reset.link_invalid` | Invalid password reset link. | Geçersiz parola sıfırlama bağlantısı. | 🟢 | |
| `verify.success` | Email verified successfully! ... | E-posta adresiniz doğrulandı. Artık giriş yapabilirsiniz. | 🟢 | |
| `verify.expired` | Verification link expired. ... | Doğrulama bağlantısının süresi dolmuş. Yeniden kayıt olun veya yeni bir doğrulama e-postası isteyin. | 🟢 | |
| `verify.resend_button` | Resend verification email | Doğrulama e-postasını yeniden gönder | 🟢 | |
| `verify.resent` | Verification email sent. ... | Doğrulama e-postası gönderildi. Gelen kutunuzu kontrol edin. | 🟢 | |
| `verify.resend_failed` | Failed to resend verification email. | Doğrulama e-postası gönderilemedi. | 🟢 | |
| `google_failed` | Google authentication failed | Google ile kimlik doğrulama başarısız | 🟢 | |
| `failed` | Authentication failed | Kimlik doğrulama başarısız | 🟢 | |

## `nav.*`

| Key | EN | TR (draft) | Flag | Notes |
|---|---|---|---|---|
| `recent` | Recent | Son açılanlar | 🟡 | Alt: "Geçmiş" (history). |
| `recent_files_title` | Recent files | Son açılan dosyalar | 🟢 | |
| `recent_files_header` | Recent Files | Son Açılan Dosyalar | 🟢 | |
| `notifications` | Notifications | Bildirimler | 🟢 | |
| `notifications_title` | Notifications | Bildirimler | 🟢 | |
| `notifications_none` | No notifications | Bildirim yok | 🟢 | |
| `mark_all_read` | Mark all read | Tümünü okundu işaretle | 🟡 | Alt: "Hepsini okundu işaretle". |
| `someone` | Someone | Bir kullanıcı | 🟡 | Lock-request fallback when name missing. "Birisi" possible. |
| `lock_request_text` | <1>{requester}</1> requests lock on <2>{element}</2> | <1>{requester}</1> kullanıcısı <2>{element}</2> üzerinde kilit istiyor | 🔴 | **MBSE check**: "kilit" for element-level lock — confirm vs "rezerv"/"çekme". |
| `training` | Training | Eğitim | 🟢 | |
| `training_title` | Open interactive SysML v2 training | Etkileşimli SysML v2 eğitimini aç | 🟢 | |
| `settings` | Settings | Ayarlar | 🟢 | |
| `settings_title` | MCP connection settings | MCP bağlantı ayarları | ⚪ | "MCP" kept as acronym. |
| `logout` | Logout | Çıkış yap | 🟢 | |
| `language_switcher_label` | Language | Dil | 🟢 | |
| `language_tr` | Türkçe | Türkçe | ⚪ | Always native form. |
| `language_en` | English | English | ⚪ | Always native form. |

## `editor.*`

| Key | EN | TR (draft) | Flag | Notes |
|---|---|---|---|---|
| `read_only_suffix` | ` (Read Only)` | ` (Salt Okunur)` | 🟢 | |
| `check_out_to_edit_suffix` | ` (Check out to edit)` | ` (Düzenlemek için al)` | 🔴 | **MBSE check**: "check out" terminology — alt: "rezerv et", "çek". |
| `switch_file_title` | Switch to another file in this project | Bu projedeki başka bir dosyaya geç | 🟢 | |
| `project_files_header` | `{project} — Files` | `{project} — Dosyalar` | 🟢 | |
| `checkout_warning` | Cannot edit without check-out. Right-click an element in the diagram to check out. | Düzenlemek için elemanı almanız gerekiyor. Diyagramda elemana sağ tıklayıp alın. | 🔴 | Tied to lock-request terminology decision. |
| `locked_by_others_count_*` | `{count} locked by others` | `Başkaları tarafından {count} eleman alındı` | 🟡 | Tied to lock terminology. |
| `request_element_title` | Request this element from the holder | Bu elemanı sahibinden talep et | 🟡 | "sahibinden" emphasizes ownership; alt "kilidi tutan kişiden". |
| `problems_panel` | Problems | Sorunlar | 🟢 | |
| `no_problems` | No problems detected. | Sorun yok. | 🟢 | |
| `view_general` | General View | Genel Görünüm | 🔴 | **MBSE view names**: confirm Turkish standards. SysML 2.0 spec doesn't define Turkish names. |
| `view_interconnection` | Interconnection View | Bağlantı Görünümü | 🔴 | Alt: "Bağlantılar", "Birleştirme". |
| `view_action_flow` | Action Flow View | Eylem Akışı Görünümü | 🔴 | Alt: "Etkinlik Akışı" (BPMN-style); confirm with SysML TR translations if any. |
| `view_state_transition` | State Transition View | Durum Geçişi Görünümü | 🔴 | Standard automata terminology. |
| `view_sequence` | Sequence View | Sıralama Görünümü | 🔴 | Alt: "Sıra Görünümü" / "Sekans Görünümü" (UML term). |
| `view_grid` | Grid View | Tablo Görünümü | 🟡 | Alt: "Izgara Görünümü" (more literal). |
| `view_browser` | Browser View | Tarayıcı Görünümü | 🟡 | "Browser" here means tree-browser, not web browser. Alt: "Gezgin Görünümü". |
| `view_geometry` | Geometry View | Geometri Görünümü | 🟢 | |
| `open_editor_title` | Open editor | Editörü aç | 🟢 | |
| `close_editor_title` | Close editor | Editörü kapat | 🟢 | |
| `open_ai_title` | Open AI chat | AI sohbeti aç | 🟢 | |
| `close_ai_title` | Close AI chat | AI sohbeti kapat | 🟢 | |
| `undo_title` | Undo (Ctrl+Z) | Geri al (Ctrl+Z) | 🟢 | |
| `redo_title` | Redo (Ctrl+Y) | Yinele (Ctrl+Y) | 🟡 | Alt: "İleri al". |
| `toggle_problems_title` | Toggle Problems panel | Sorunlar panelini aç/kapat | 🟢 | |
| `err_check_out` | Failed to check out element | Eleman alınamadı | 🟡 | Tied to lock terminology. |
| `err_check_in` | Failed to check in element | Eleman iade edilemedi | 🟡 | |
| `err_send_lock_request` | Failed to send lock request | Kilit isteği gönderilemedi | 🟡 | |
| `err_save` | Save failed | Kaydedilemedi | 🟢 | |

## `error_boundary.*`

| Key | EN | TR (draft) | Flag | Notes |
|---|---|---|---|---|
| `title` | Something went wrong | Bir sorun oluştu | 🟢 | |
| `description` | An unexpected error occurred | Beklenmeyen bir hata gerçekleşti | 🟢 | |
| `try_again` | Try Again | Tekrar dene | 🟢 | |
| `go_to_projects` | Go to Projects | Projelere git | 🟢 | |

## `bug_report.*`

| Key | EN | TR (draft) | Flag | Notes |
|---|---|---|---|---|
| `button_title` | Report a bug | Hata bildir | 🟢 | |
| `title` | Report a Bug | Hata Bildir | 🟢 | |
| `success` | Thank you! Your report has been submitted. | Teşekkürler! Raporunuz iletildi. | 🟢 | |
| `description_label` | Describe the issue * | Sorunu anlatın * | 🟢 | |
| `description_placeholder` | What happened? What did you expect to happen? | Ne oldu? Ne olmasını bekliyordunuz? | 🟢 | |
| `screenshot_label` | Screenshot (optional) | Ekran görüntüsü (opsiyonel) | 🟢 | |
| `screenshot_drop` | Drop a screenshot here or click to browse | Ekran görüntüsünü buraya bırakın veya tıklayarak seçin | 🟢 | |
| `remove_screenshot` | Remove screenshot | Ekran görüntüsünü kaldır | 🟢 | |
| `submit` | Submit Report | Raporu gönder | 🟢 | |
| `submitting` | Submitting... | Gönderiliyor... | 🟢 | |
| `error_image_only` | Only image files are accepted | Yalnızca resim dosyaları kabul edilir | 🟢 | |
| `error_too_large` | Screenshot must be under 5MB | Ekran görüntüsü 5MB'tan küçük olmalı | 🟢 | |
| `error_no_description` | Please describe the issue | Sorunu açıklayın | 🟢 | |
| `error_submit_failed` | Failed to submit report | Rapor gönderilemedi | 🟢 | |

## `ai.*`

| Key | EN | TR (draft) | Flag | Notes |
|---|---|---|---|---|
| `chat_title` | AI Chat | AI Sohbet | 🟢 | |
| `tier_free` | Free | Ücretsiz | 🟢 | |
| `settings_title` | AI Settings | AI Ayarları | 🟢 | |
| `clear_chat_title` | Clear chat | Sohbeti temizle | 🟢 | |
| `close_title` | Close | Kapat | 🟢 | |
| `free_quota` | `{used} / {limit} free messages` | `{used} / {limit} ücretsiz mesaj` | 🟢 | |
| `upgrade` | Upgrade | Yükselt | 🟡 | Alt: "Yükselt" / "Üst sürüme geç". |
| `add_key` | Add your key for unlimited | Sınırsız için kendi anahtarınızı ekleyin | 🟢 | |
| `connect_title` | Connect AI Provider | AI Sağlayıcısına Bağlan | 🟢 | |
| `connect_description` | Add your AI provider API key in Settings to start chatting. | Sohbete başlamak için Ayarlar'dan AI sağlayıcı API anahtarınızı ekleyin. | 🟢 | |
| `configure_provider` | Configure AI Provider | AI Sağlayıcısını Yapılandır | 🟢 | |
| `empty_prompt` | Ask the AI to edit your SysML model, fix errors, explain code, or generate new elements. | AI'dan SysML modelinizi düzenlemesini, hataları gidermesini, kodu açıklamasını veya yeni öğeler üretmesini isteyin. | 🟡 | Long sentence; could be split. |
| `free_tier_remaining` | You're on the free tier ({remaining} messages left). | Ücretsiz katmandasınız ({remaining} mesaj kaldı). | 🟢 | |
| `input_placeholder` | Ask about your SysML model... | SysML modeliniz hakkında sorun... | 🟢 | |
| `input_quota_exhausted` | Free tier limit reached — add your key in Settings | Ücretsiz katman sınırına ulaşıldı — Ayarlar'dan anahtarınızı ekleyin | 🟢 | |
| `send_title` | Send (Enter) | Gönder (Enter) | 🟢 | |
| `stop_title` | Stop | Durdur | 🟢 | |
| `limit_reached_title` | Limit reached | Sınıra ulaşıldı | 🟢 | |
| `error_prefix` | `**Error:** ` | `**Hata:** ` | 🟢 | |
| `error_fallback` | Failed | Başarısız | 🟢 | |
| `tokens_summary` | Tokens: {input} in + {output} out | Token: {input} girdi + {output} çıktı | ⚪ | "Token" kept as English loanword. |
| `tokens_total` | {total} total | Toplam {total} | 🟢 | |
| `tokens_calculating` | Calculating tokens... | Token sayılıyor... | 🟢 | |
| `tokens_label` | Token usage | Token kullanımı | 🟢 | |
| `tool_args` | Args: | Argümanlar: | 🟢 | |
| `tool_result` | Result: | Sonuç: | 🟢 | |

## `settings.*`

| Key | EN | TR (draft) | Flag | Notes |
|---|---|---|---|---|
| `page_title` | Settings | Ayarlar | 🟢 | |
| `tab_account` | Account | Hesap | 🟢 | |
| `tab_ai_provider` | AI Provider | AI Sağlayıcı | 🟢 | |
| `tab_mcp` | MCP | MCP | ⚪ | Protocol acronym. |
| `tab_enterprises` | Enterprises | Kurumlar | 🟡 | Alt: "Kuruluşlar" / "İşletmeler" / "Şirketler". Decision affects projects.* too. |
| `tab_admin` | Admin | Yönetim | 🟡 | Alt: "Yönetici" (admin-as-person) vs "Yönetim" (admin area). |
| `tab_bug_reports` | Bug Reports | Hata Raporları | 🟢 | |
| `section_account` | Account | Hesap | 🟢 | |
| `section_profile` | Profile | Profil | 🟢 | |
| `section_change_password` | Change Password | Parolayı değiştir | 🟢 | |
| `label_email` | Email | E-posta | 🟢 | |
| `label_current_password` | Current Password | Mevcut parola | 🟢 | |
| `label_new_password` | New Password | Yeni parola | 🟢 | |
| `label_confirm_new_password` | Confirm New Password | Yeni parolayı doğrula | 🟡 | Alt: "Yeni parolayı tekrar girin". |
| `passwords_mismatch` | Passwords do not match | Parolalar eşleşmiyor | 🟢 | |
| `password_too_short` | Password must be at least 8 characters | Parola en az 8 karakter olmalı | 🟢 | |
| `err_change_password` | Failed to change password | Parola değiştirilemedi | 🟢 | |
| `section_mcp_connection` | MCP Connection | MCP Bağlantısı | ⚪ | |
| `section_create_token` | Create Access Token | Erişim Token'ı Oluştur | ⚪ | "Token" loanword. |
| `label_token_name` | Token name | Token adı | ⚪ | |
| `label_expires_in_days` | Expires in (days) | Geçerlilik (gün) | 🟡 | Alt: "Süre (gün)". |
| `placeholder_never` | Never | Süresiz | 🟡 | Alt: "Hiç". "Süresiz" is more clear for "no expiration". |
| `token_created_title` | Token Created — Copy It Now | Token Oluşturuldu — Şimdi Kopyalayın | ⚪ | |
| `generate_config_for` | Generate config for: | Yapılandırma şu istemci için: | 🟡 | Awkward phrasing; alt: "İstemci yapılandırması:" |
| `section_active_tokens` | Active Tokens | Aktif Token'lar | ⚪ | |
| `tokens_loading` | Loading... | Yükleniyor... | 🟢 | |
| `no_active_tokens` | No active tokens. Create one above to connect your AI client. | Aktif token yok. AI istemcinizi bağlamak için yukarıdan bir tane oluşturun. | ⚪ | |
| `section_revoked_tokens` | Revoked Tokens | İptal Edilmiş Token'lar | ⚪ | |
| `section_how_it_works` | How It Works | Nasıl Çalışır | 🟢 | |
| `section_available_tools` | Available MCP Tools | Kullanılabilir MCP Araçları | 🟢 | |
| `section_supported_clients` | Supported AI Clients | Desteklenen AI İstemcileri | 🟢 | |
| `err_load_tokens` | Failed to load tokens | Token'lar yüklenemedi | ⚪ | |
| `err_create_token` | Failed to create token | Token oluşturulamadı | ⚪ | |
| `err_revoke_token` | Failed to revoke token | Token iptal edilemedi | ⚪ | |
| `section_ai_chat_provider` | AI Chat Provider | AI Sohbet Sağlayıcısı | 🟢 | |
| `label_provider` | Provider | Sağlayıcı | 🟢 | |
| `connected` | Connected | Bağlandı | 🟡 | Alt: "Bağlı". |
| `disconnect` | Disconnect | Bağlantıyı kes | 🟢 | |
| `not_connected` | Not connected — enter your API key below | Bağlı değil — aşağıya API anahtarınızı girin | 🟢 | |
| `label_model` | Model | Model | 🟢 | |
| `section_enterprises` | Enterprises | Kurumlar | 🟡 | Tied to `tab_enterprises`. |
| `placeholder_enterprise_name` | Enterprise name | Kurum adı | 🟡 | |
| `no_enterprises_yet` | No enterprises yet. Create one above. | Henüz kurum yok. Yukarıdan bir tane oluşturun. | 🟢 | |
| `role_admin` | Admin | Yönetici | 🟢 | Role label. |
| `placeholder_email_address` | Email address | E-posta adresi | 🟢 | |
| `no_members_yet` | No members yet. | Henüz üye yok. | 🟢 | |
| `err_load_enterprises` ... `err_revoke_invitation` | ... | ... | 🟢 | Error strings — all standard. |
| `prompt_rename_enterprise` | Rename enterprise: | Kurumu yeniden adlandır: | 🟢 | |
| `section_system_examples` | System Examples | Sistem Örnekleri | 🟢 | |
| `section_system_projects` | System Projects | Sistem Projeleri | 🟢 | |
| `loading_users` | Loading... | Yükleniyor... | 🟢 | |
| `err_load_users` | Failed to load users | Kullanıcılar yüklenemedi | 🟢 | |
| `loading_projects` | Loading projects... | Projeler yükleniyor... | 🟢 | |
| `no_personal_projects` | No personal projects | Kişisel proje yok | 🟢 | |
| `loading_files` | Loading files... | Dosyalar yükleniyor... | 🟢 | |
| `no_files` | No files | Dosya yok | 🟢 | |
| `loading_content` | Loading... | Yükleniyor... | 🟢 | |
| `confirm_delete_bug_report` | Delete this bug report? | Bu hata raporu silinsin mi? | 🟢 | |
| `status_resolved` | Resolved | Çözüldü | 🟢 | |
| `status_closed` | Closed | Kapatıldı | 🟢 | |
| `no_bug_reports` | No bug reports found. | Hata raporu bulunamadı. | 🟢 | |
| `action_resolve` | Resolve | Çöz | 🟡 | Alt: "Çözüldü olarak işaretle". |
| `action_close` | Close | Kapat | 🟢 | |
| `action_delete` | Delete | Sil | 🟢 | |
| `action_rename` | Rename | Yeniden adlandır | 🟢 | |

## `projects.*`

| Key | EN | TR (draft) | Flag | Notes |
|---|---|---|---|---|
| `header` | Projects | Projeler | 🟢 | |
| `new_placeholder` | New project name | Yeni proje adı | 🟢 | |
| `personal_option` | Personal | Kişisel | 🟢 | |
| `loading` | Loading... | Yükleniyor... | 🟢 | |
| `filter_all` | All | Tümü | 🟢 | |
| `filter_system` | System | Sistem | 🟢 | |
| `filter_enterprise` | Enterprise | Kurumsal | 🟡 | Tied to `tab_enterprises` decision. |
| `filter_personal` | Personal | Kişisel | 🟢 | |
| `section_system` | System | Sistem | 🟢 | |
| `section_enterprise` | Enterprise | Kurumsal | 🟡 | |
| `section_enterprise_restricted` | (Restricted) | (Kısıtlı) | 🟢 | |
| `section_personal` | Personal | Kişisel | 🟢 | |
| `ent_badge_title` | Enterprise — restricted access | Kurumsal — kısıtlı erişim | 🟡 | |
| `read_only` | (Read Only) | (Salt Okunur) | 🟢 | |
| `system_tag` | (System) | (Sistem) | 🟢 | |
| `enterprise_members_only` | Enterprise · Members only | Kurumsal · Yalnızca üyeler | 🟢 | |
| `upload_button` | Upload .sysml | .sysml yükle | 🟢 | |
| `new_file_button` | + New File | + Yeni Dosya | 🟢 | |
| `no_files` | No files yet. Create a new file or drag & drop .sysml files here. | Henüz dosya yok. Yeni dosya oluşturun veya .sysml dosyalarını buraya sürükleyip bırakın. | 🟢 | |
| `select_prompt` | Select a project to view its files | Dosyalarını görmek için bir proje seçin | 🟢 | |
| `menu_rename` | Rename | Yeniden adlandır | 🟢 | |
| `menu_new_subproject` | New Subproject | Yeni alt proje | 🟢 | |
| `menu_download` | Download | İndir | 🟢 | |
| `menu_delete` | Delete | Sil | 🟢 | |
| `menu_copy_to_my_project` | Copy to My Project | Projeme kopyala | 🟡 | Alt: "Kendi projeme kopyala". |
| `menu_move_to` | Move to... | Taşı... | 🟢 | |
| `prompt_file_name` | File name (extension .sysml will be added automatically): | Dosya adı (.sysml uzantısı otomatik eklenir): | 🟢 | |
| `prompt_subproject_name` | Subproject name: | Alt proje adı: | 🟢 | |
| `prompt_rename_project` | Rename project: | Projeyi yeniden adlandır: | 🟢 | |
| `prompt_rename_file` | Rename file (.sysml will be added automatically): | Dosyayı yeniden adlandır (.sysml otomatik eklenir): | 🟢 | |
| `prompt_move_header` | Move to project: | Hangi projeye taşınsın: | 🟡 | Alt: "Taşınacak proje:". |
| `prompt_copy_header` | Copy to project: | Hangi projeye kopyalansın: | 🟡 | |
| `prompt_enter_number` | Enter number: | Numara girin: | 🟢 | |
| `confirm_delete_project_with_children` | `Delete project "{name}", its subproject(s), and all files?` | `"{name}" projesi, alt projeleri ve tüm dosyaları silinsin mi?` | 🟢 | |
| `confirm_delete_project` | `Delete project "{name}" and all its files?` | `"{name}" projesi ve tüm dosyaları silinsin mi?` | 🟢 | |
| `confirm_delete_file` | `Delete file "{name}"?` | `"{name}" dosyası silinsin mi?` | 🟢 | |
| `err_invalid_file_name` | Invalid file name | Geçersiz dosya adı | 🟢 | |
| `err_invalid_selection` | Invalid selection | Geçersiz seçim | 🟢 | |
| `err_no_other_projects` | No other projects to move to | Taşınacak başka proje yok | 🟢 | |
| `err_create_project_first` | Create a project first, then copy the file into it | Önce bir proje oluşturun, sonra dosyayı oraya kopyalayın | 🟢 | |
| `err_load_projects` ... `err_copy_file` | ... | ... | 🟢 | All standard error strings. |
| `err_upload_file` | `Failed to upload {name}` | `{name} yüklenemedi` | 🟢 | |

## `training.*`

| Key | EN | TR (draft) | Flag | Notes |
|---|---|---|---|---|
| `mode` | Training Mode | Eğitim Modu | 🟢 | |
| `exit` | Exit Training | Eğitimden çık | 🟢 | |
| `level_label` | `Level {level}` | `Seviye {level}` | 🟢 | |
| `progress_count` | `{completed} / {total} done` | `{completed} / {total} tamamlandı` | 🟢 | |
| `tab_task` | Task | Görev | 🟢 | |
| `tab_elements` | `Elements ({count})` | `Elemanlar ({count})` | 🔴 | **MBSE**: "Eleman" vs "Öğe" — confirm. Consistent with `nav.lock_request`. |
| `diagram_label` | General View | Genel Görünüm | 🔴 | Same as editor.view_general. |
| `diagram_subtitle` | live | canlı | 🟢 | |
| `editor_label` | SysML Editor | SysML Editörü | 🟢 | |
| `editor_subtitle` | type your model here | modelinizi buraya yazın | 🟢 | |
| `target_label` | Target Notation | Hedef Gösterim | 🟡 | Alt: "Hedef Notasyon". "Gösterim" is more native; "Notasyon" is the SysML term. |
| `target_subtitle` | reference | referans | 🟢 | |
| `feedback_hint` | `Edit the model in the editor, then click "Check Answer"` | `Modelinizi editörde düzenleyin, ardından "Cevabı Kontrol Et" tıklayın` | 🟡 | "Check Answer" button label is not yet externalized — see Remaining Work below. |
| `complete_title` | Training Complete! | Eğitim Tamamlandı! | 🟢 | |
| `complete_description` | You completed 100 training tasks ... | SysML v2 dilinin tamamını kapsayan 100 eğitim görevini tamamladınız — parça tanımları, öznitelikler, özelleştirme, kompozisyon, alt-küme, yeniden tanımlama, portlar, öğeler, sayım türleri, eylemler, durumlar, gereksinimler, kısıtlar, hesaplamalar, paketler, kullanım durumları, atama, görünümler ve bakış açıları. Artık her sistemi modelleyebilirsiniz. | 🔴 | **MBSE terminology cluster**: parça/öznitelik/özelleştirme/kompozisyon/alt-küme/yeniden tanımlama/port/öğe/sayım türü/eylem/durum/gereksinim/kısıt/hesaplama/paket/kullanım durumu/atama/görünüm/bakış açısı — many of these are in active debate in Turkish MBSE academia. Please pass once. |
| `review_tasks` | Review Tasks | Görevleri gözden geçir | 🟢 | |
| `start_over` | Start Over | Baştan başla | 🟢 | |
| `go_to_projects` | Go to Projects | Projelere git | 🟢 | |

## `errors.*` (backend code → message mapping)

| Key | EN | TR (draft) | Flag | Notes |
|---|---|---|---|---|
| `Unauthorized` | Session expired. Please sign in again. | Oturumunuzun süresi doldu. Yeniden giriş yapın. | 🟢 | |
| `Forbidden` | You don't have permission to do that. | Bu işlem için yetkiniz yok. | 🟢 | |
| `BadRequest` | The request was invalid. | İstek geçersiz. | 🟢 | |
| `NotFound` | Not found. | Bulunamadı. | 🟢 | |
| `PayloadTooLarge` | The file is too large. | Dosya çok büyük. | 🟢 | |
| `ValidationFailed` | Some fields are invalid. | Bazı alanlar geçersiz. | 🟢 | |
| `RateLimited` | Too many requests. Please wait a moment. | Çok fazla istek. Biraz bekleyin. | 🟢 | |
| `Network` | Network error. Check your connection. | Ağ hatası. Bağlantınızı kontrol edin. | 🟢 | |
| `Unknown` | Something went wrong. | Bir sorun oluştu. | 🟢 | |

---

## Remaining Work (not yet externalized in Phase 1)

These strings exist in the codebase but were not externalized due to scope/time. They currently render in English regardless of language setting. All flagged for a Phase 1.5 follow-up:

### Settings page detail forms
- `SettingsPage.tsx` MCP section: token form helper text, "Show key" toggles, copy buttons, "How It Works" paragraph body, tool list items, client config download buttons (`Claude Desktop`, `Cursor`, `VS Code Copilot`, `Windsurf` are brand names — keep as-is).
- AI Provider section: provider radio button labels (`Anthropic / Claude`, `OpenAI / GPT`, `Google / Gemini`), model picker, API key input helper text, "Save", "Show key" / "Hide key", "Add Key" buttons.
- Startups section: invitation form labels, member role dropdown options, "Invite" / "Add" / "Remove" buttons, table headers (`Email`, `Role`, `Member Since`).
- Admin sections: "Sync from disk", "View files", user table headers, system project tree labels.
- Bug Reports section: filter dropdown options (`All`, `Open`, `Resolved`, `Closed`), table columns, status badge labels.

### Diagram chrome
- `DiagramViewer.tsx` (2930 lines): zoom/pan toolbar tooltips, context menu items ("Hide", "Show", "Expand", "Collapse"), export dropdown labels (`PNG`/`SVG` as values are fine), legend labels, view-switcher menu items.
- `ElementPanel.tsx` (1282 lines): section headers (`Elements`, `Relations`), search placeholder, sort/group buttons, "Save view" / "Restore view" tooltips, element kind labels.
- `SequenceRenderer.tsx`, `GridRenderer.tsx`, `BrowserRenderer.tsx`: panel-internal labels, search placeholder.

### Editor page detail
- `EditorPage.tsx`: AI assistant inline references, member lock indicators ("locked by you" / "you hold this"), keyboard shortcut tooltips on diagram action buttons, file context menu items in editor view.

### Monaco editor hover/intellisense
- LSP hover content and completion item labels are out of scope for Phase 1 per brief §3.

---

## How to use this list

1. Read each row's EN + TR draft side-by-side.
2. Fix any 🔴 (MBSE jargon) and 🟡 (alternatives) entries directly in `packages/web-client/src/i18n/tr.json`.
3. Run `pnpm --filter @systemodel/web-client test` to ensure key-set parity is still enforced by `src/store/i18n.test.ts` (`every key in en bundle exists in tr bundle`).
4. Hot-reload picks up edits automatically — no rebuild needed.
5. The Diagram + Settings detail strings can be batched as Phase 1.5 once terminology is locked.
