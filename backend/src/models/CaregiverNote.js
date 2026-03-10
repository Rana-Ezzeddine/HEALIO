import { DataTypes } from "sequelize";
import sequelize from "../../database.js";

const CaregiverNote = sequelize.define(
    "CaregiverNote",
    {
        id: {
            type: DataTypes.UUID,
            defaultValue: DataTypes.UUIDV4,
            primaryKey: true,
        },
        patientId: {
            type: DataTypes.UUID,
            allowNull: false,
            references: {
                model: "users",
                key: "id",
            },
            onDelete: "CASCADE",
            onUpdate: "CASCADE",
        },
        caregiverId: {
            type: DataTypes.UUID,
            allowNull: false,
            references: {
                model: "users",
                key: "id",
            },
            onDelete: "CASCADE",
            onUpdate: "CASCADE",
        },
        note: {
            type: DataTypes.TEXT,
            allowNull: false,
        },
    },
    {
        tableName: "caregiver_notes",
        timestamps: true,
        indexes: [
            { fields: ["patientId"] },
            { fields: ["caregiverId"] },
            { fields: ["createdAt"] },
        ],
    }
);

export default CaregiverNote;