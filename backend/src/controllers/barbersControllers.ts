import { Request, Response } from "express";
import { createBarber } from "../repositories/barbers";


export const handleBarberCreation = async (req: Request, res: Response) => {
  const name = typeof req.body?.name === "string" ? req.body.name.trim() : "";
  const image = req.file;  

    if (!name?.trim() || name.trim().length > 100 || !image) {
        return res.status(400).json({
            message: "Preenche o nome e envia uma fotografia do barbeiro.",
        });
    }
    
    try{
        const newBarber = await createBarber({ name: name.trim() }, image);
        res.status(201).json({
            message: `Barbeiro ${name} criado com sucesso.`,
            barber: newBarber,
        });
    }catch (error) {
        console.error("Erro ao criar o barbeiro:", error);
        res.status(500).json({ 
            message: "Erro ao criar o barbeiro.",
        });
    }
};
