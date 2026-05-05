//
//  AuthView.swift
//  ResiduePhone
//
//  Sign-in screen for the iOS companion. Three entry paths share this
//  view so the "I just want to pair with the desktop" flow doesn't
//  force the user to type their account password on the phone:
//
//    1. Sign in        — email + password against the same Mongo
//                        `users` collection the desktop uses.
//    2. Create account — same backend, sign-up flow.
//    3. Pair with code — the 6-digit code generated on the desktop
//                        ("Generate pairing code" button). The code
//                        IS the auth factor: /api/pair/code-login
//                        mints a token AND binds the phone to the
//                        in-progress study session in one round-trip.
//
//  After any of the three succeed, RootView routes the user to
//  SessionView and the active-session poller takes over for live
//  rising/falling-edge auto-bind on every subsequent desktop session.
//

import SwiftUI

struct AuthView: View {
    enum Mode: String, CaseIterable, Identifiable {
        case login
        case register
        case code

        var id: String { rawValue }

        var pickerLabel: String {
            switch self {
            case .login: return "Sign in"
            case .register: return "Create"
            case .code: return "6-digit code"
            }
        }
    }

    @EnvironmentObject private var session: SessionStore
    @State private var mode: Mode = .login
    @State private var email: String = ""
    @State private var password: String = ""
    @State private var code: String = ""
    @State private var busy: Bool = false

    var body: some View {
        Form {
            Section {
                Picker("Mode", selection: $mode) {
                    ForEach(Mode.allCases) { m in
                        Text(m.pickerLabel).tag(m)
                    }
                }
                .pickerStyle(.segmented)
            }

            switch mode {
            case .login, .register:
                accountSection
            case .code:
                codeSection
            }

            Section {
                Button {
                    Task { await submit() }
                } label: {
                    HStack {
                        Spacer()
                        if busy { ProgressView() } else {
                            Text(submitLabel)
                        }
                        Spacer()
                    }
                }
                .buttonStyle(.borderedProminent)
                .disabled(busy || !canSubmit)
            }

            if let msg = session.statusMessage {
                Section { Text(msg).foregroundStyle(.red).font(.footnote) }
            }
        }
    }

    @ViewBuilder
    private var accountSection: some View {
        Section {
            TextField("Email", text: $email)
                .textContentType(.emailAddress)
                .keyboardType(.emailAddress)
                .autocapitalization(.none)
            SecureField("Password", text: $password)
                .textContentType(mode == .login ? .password : .newPassword)
        } header: {
            Text(mode == .login ? "Sign in" : "Create an account")
        } footer: {
            Text(
                "Use the same email and password you signed up with on "
                + "the Residue desktop app."
            )
            .font(.caption2)
        }
    }

    @ViewBuilder
    private var codeSection: some View {
        Section {
            TextField("000000", text: $code)
                .keyboardType(.numberPad)
                .font(.system(size: 28, weight: .bold, design: .monospaced))
                .multilineTextAlignment(.center)
                .onChange(of: code) { newValue in
                    let digits = newValue.filter { $0.isNumber }
                    code = String(digits.prefix(6))
                }
        } header: {
            Text("Pair with desktop")
        } footer: {
            Text(
                "On your desktop, start a study session and tap "
                + "“Generate pairing code”. Type the 6-digit code here "
                + "to sign in and pair without typing your account "
                + "password."
            )
            .font(.caption2)
        }
    }

    private var submitLabel: String {
        switch mode {
        case .login: return "Sign in"
        case .register: return "Create account"
        case .code: return "Pair with desktop"
        }
    }

    private var canSubmit: Bool {
        switch mode {
        case .login, .register:
            return !email.isEmpty && password.count >= 6
        case .code:
            return code.count == 6
        }
    }

    private func submit() async {
        busy = true
        defer { busy = false }
        switch mode {
        case .login:
            await session.login(email: email, password: password)
        case .register:
            await session.register(email: email, password: password)
        case .code:
            await session.loginWithCode(code: code)
        }
    }
}
