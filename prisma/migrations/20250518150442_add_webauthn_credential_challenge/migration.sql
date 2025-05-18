BEGIN TRY

BEGIN TRAN;

-- CreateTable
CREATE TABLE [dbo].[Users] (
    [id] INT NOT NULL IDENTITY(1,1),
    [name] VARCHAR(100) NOT NULL,
    [id_number] VARCHAR(50) NOT NULL,
    [role] VARCHAR(20) NOT NULL,
    [phone_number] VARCHAR(20) NOT NULL,
    [gender] VARCHAR(10) NOT NULL,
    [is_active] BIT NOT NULL CONSTRAINT [Users_is_active_df] DEFAULT 1,
    [created_at] DATETIME2 NOT NULL CONSTRAINT [Users_created_at_df] DEFAULT CURRENT_TIMESTAMP,
    [updated_at] DATETIME2 NOT NULL,
    [created_by] VARCHAR(100) NOT NULL,
    CONSTRAINT [Users_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [Users_id_number_key] UNIQUE NONCLUSTERED ([id_number])
);

-- CreateTable
CREATE TABLE [dbo].[Employees] (
    [id] INT NOT NULL IDENTITY(1,1),
    [employee_id] INT NOT NULL,
    [name] VARCHAR(100) NOT NULL,
    [id_number] VARCHAR(50) NOT NULL,
    [role] VARCHAR(20) NOT NULL,
    [email] VARCHAR(100) NOT NULL,
    [password] VARCHAR(255) NOT NULL,
    [date_of_birth] DATE NOT NULL,
    [id_card_path] VARCHAR(255) NOT NULL,
    [passport_photo] VARCHAR(255) NOT NULL,
    [created_at] DATETIME2 NOT NULL CONSTRAINT [DF_Employeescreat_3A81B327] DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT [Employees_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [Employees_employee_id_key] UNIQUE NONCLUSTERED ([employee_id]),
    CONSTRAINT [UQ_Employee_AB6E61647DECD8E0] UNIQUE NONCLUSTERED ([email])
);

-- CreateTable
CREATE TABLE [dbo].[Attendance] (
    [id] INT NOT NULL IDENTITY(1,1),
    [employee_id] INT NOT NULL,
    [date] DATE NOT NULL,
    [check_in_time] DATETIME2,
    [check_out_time] DATETIME2,
    [status] VARCHAR(10) NOT NULL CONSTRAINT [DF_Attendancstatu_403A8C7D] DEFAULT 'Absent',
    CONSTRAINT [PK_Attendan_3213E83FBD2CD3D1] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [Attendance_employee_id_date_key] UNIQUE NONCLUSTERED ([employee_id],[date])
);

-- CreateTable
CREATE TABLE [dbo].[PasswordReset] (
    [id] INT NOT NULL IDENTITY(1,1),
    [employee_id] INT NOT NULL,
    [token] NVARCHAR(1000) NOT NULL,
    [expires] DATETIME2 NOT NULL,
    [used] BIT NOT NULL CONSTRAINT [PasswordReset_used_df] DEFAULT 0,
    [created_at] DATETIME2 NOT NULL CONSTRAINT [PasswordReset_created_at_df] DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT [PasswordReset_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [PasswordReset_token_key] UNIQUE NONCLUSTERED ([token])
);

-- CreateTable
CREATE TABLE [dbo].[AttendanceProcessingLog] (
    [id] INT NOT NULL IDENTITY(1,1),
    [date] DATETIME2 NOT NULL,
    [records_processed] INT NOT NULL,
    [status] NVARCHAR(1000) NOT NULL,
    [created_at] DATETIME2 NOT NULL CONSTRAINT [AttendanceProcessingLog_created_at_df] DEFAULT CURRENT_TIMESTAMP,
    [updated_at] DATETIME2 NOT NULL,
    CONSTRAINT [AttendanceProcessingLog_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [AttendanceProcessingLog_date_key] UNIQUE NONCLUSTERED ([date])
);

-- CreateTable
CREATE TABLE [dbo].[WebAuthnCredentials] (
    [id] NVARCHAR(1000) NOT NULL,
    [userId] INT NOT NULL,
    [credentialId] NVARCHAR(1000) NOT NULL,
    [publicKey] NVARCHAR(1000) NOT NULL,
    [counter] INT NOT NULL,
    [transports] NVARCHAR(1000),
    [created_at] DATETIME2 NOT NULL CONSTRAINT [WebAuthnCredentials_created_at_df] DEFAULT CURRENT_TIMESTAMP,
    [updated_at] DATETIME2 NOT NULL,
    CONSTRAINT [WebAuthnCredentials_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [WebAuthnCredentials_credentialId_key] UNIQUE NONCLUSTERED ([credentialId])
);

-- CreateTable
CREATE TABLE [dbo].[WebAuthnCredentialChallenge] (
    [userId] INT NOT NULL,
    [challenge] NVARCHAR(1000) NOT NULL,
    [expires] DATETIME2 NOT NULL,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [WebAuthnCredentialChallenge_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [WebAuthnCredentialChallenge_pkey] PRIMARY KEY CLUSTERED ([userId])
);

-- CreateIndex
CREATE NONCLUSTERED INDEX [Users_id_number_idx] ON [dbo].[Users]([id_number]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [Employees_id_number_role_idx] ON [dbo].[Employees]([id_number], [role]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [PasswordReset_token_idx] ON [dbo].[PasswordReset]([token]);

-- AddForeignKey
ALTER TABLE [dbo].[Employees] ADD CONSTRAINT [Employees_employee_id_fkey] FOREIGN KEY ([employee_id]) REFERENCES [dbo].[Users]([id]) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE [dbo].[Attendance] ADD CONSTRAINT [FK_Attendancemplo_412EB0B6] FOREIGN KEY ([employee_id]) REFERENCES [dbo].[Employees]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[PasswordReset] ADD CONSTRAINT [PasswordReset_employee_id_fkey] FOREIGN KEY ([employee_id]) REFERENCES [dbo].[Employees]([id]) ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE [dbo].[WebAuthnCredentials] ADD CONSTRAINT [WebAuthnCredentials_userId_fkey] FOREIGN KEY ([userId]) REFERENCES [dbo].[Users]([id]) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE [dbo].[WebAuthnCredentialChallenge] ADD CONSTRAINT [WebAuthnCredentialChallenge_userId_fkey] FOREIGN KEY ([userId]) REFERENCES [dbo].[Users]([id]) ON DELETE CASCADE ON UPDATE CASCADE;

COMMIT TRAN;

END TRY
BEGIN CATCH

IF @@TRANCOUNT > 0
BEGIN
    ROLLBACK TRAN;
END;
THROW

END CATCH
